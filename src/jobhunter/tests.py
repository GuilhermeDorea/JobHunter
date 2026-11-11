from decimal import Decimal
from unittest.mock import patch

from django.test import Client, TestCase, override_settings
from django.utils import timezone

from .collectors import gupy
from .matching import classify, detect_area, detect_level, detect_salary, detect_state, score
from .models import Area, Job, Level, Stack
from .stacks import sync_stacks


class Rules(TestCase):
    def test_level(self):
        self.assertEqual(detect_level("Estágio em TI"), Level.INTERNSHIP)
        self.assertEqual(detect_level("Pessoa Estagiária de Engenharia Civil"), Level.INTERNSHIP)
        self.assertEqual(detect_level("Analista de Dados Jr"), Level.JUNIOR)
        self.assertEqual(detect_level("DATA ANALYST I | INTER"), Level.JUNIOR)
        self.assertEqual(detect_level("Trainee de Engenharia"), Level.TRAINEE)
        self.assertIsNone(detect_level("Desenvolvedor Python Pleno"))
        self.assertIsNone(detect_level("Analista de Dados II"))
        self.assertIsNone(detect_level("Desenvolvedor Python"))  # no explicit level
        self.assertIsNone(detect_level("Jovem Aprendiz Administrativo"))
        self.assertEqual(detect_level("Qualquer coisa Sênior", hint=Level.INTERNSHIP), Level.INTERNSHIP)

    def test_area(self):
        self.assertEqual(detect_area("Engenheiro(a) de Dados Júnior"), Area.DATA)
        self.assertEqual(detect_area("Estagio TI - Suporte N1"), Area.INFRA)
        self.assertEqual(detect_area("Estágio em Desenvolvimento de Software"), Area.SOFTWARE)
        self.assertEqual(detect_area("Estágio em Engenharia Civil"), Area.ENGINEERING)
        self.assertEqual(detect_area("Engenharia de Software Jr"), Area.SOFTWARE)
        self.assertIsNone(detect_area("Estágio em Redes Sociais"))
        self.assertIsNone(detect_area("Analista de Sistemas de Gestão Júnior"))
        self.assertIsNone(detect_area("Estágio em Pedagogia"))

    def test_salary_and_state(self):
        self.assertEqual(detect_salary("Bolsa de R$ 1.800,00 + VT de R$ 10,50 por dia"), Decimal("1800.00"))
        self.assertEqual(detect_salary("Auxílio-transporte: R$ 10,50 por dia"), None)
        self.assertEqual(detect_state("São Paulo"), "SP")
        self.assertEqual(detect_state("Belo Horizonte, MG; São Paulo, SP"), "MG")
        self.assertEqual(detect_state("Campo Grande, Mato Grosso do Sul"), "MS")
        self.assertEqual(detect_state("Remote - Mexico"), "")

    def test_stacks_word_boundaries(self):
        sync_stacks()
        item = classify({"title": "Estágio Dev", "description": "JavaScript, C++, MySQL e node.js"}, Stack.objects.all())
        names = {s.name for s in item["stacks"]}
        self.assertTrue({"JavaScript", "C++", "MySQL", "Node.js"} <= names)
        self.assertFalse({"Java", "SQL", "C"} & names)

    def test_score(self):
        total, why = score(["Python", "SQL"], None, ["Python"], Decimal("1500"))
        self.assertEqual((total, why["matched"], why["missing"]), (50, ["Python"], ["SQL"]))  # 85*0.5 + 15*0.5
        self.assertEqual(score(["Python"], Decimal("2000"), ["Python"], Decimal("1500"))[0], 100)
        self.assertEqual(score([], Decimal("700"), [], Decimal("1500"))[0], 42)  # neutral skills (42.5), pay under 50% = 0

    def test_gupy_item(self):
        j = {"id": 1, "name": "Estágio em TI", "type": "vacancy_type_internship", "workplaceType": "hybrid",
             "state": "Ceará", "city": "Fortaleza", "jobUrl": "https://x.gupy.io/job/1", "careerPageName": "ACME",
             "description": "Python&nbsp;e SQL", "publishedDate": "2026-11-11T13:25:05.518Z"}
        item = gupy.to_item(j)
        self.assertEqual((item["level"], item["state"], item["work_model"]), (Level.INTERNSHIP, "CE", "HYBRID"))
        self.assertIsNone(gupy.to_item({**j, "type": "vacancy_type_apprentice"}))


@override_settings(GEMINI_API_KEY="test-key")
class ApiFlow(TestCase):
    def setUp(self):
        sync_stacks()
        now = timezone.now()
        self.python = Stack.objects.get(name="Python")
        self.job = Job.objects.create(source="t", external_id="1", url="https://x/1", title="Estágio Python",
                                      company="ACME", level="INTERNSHIP", area="SOFTWARE", state="SP",
                                      work_model="ON_SITE", last_seen=now)
        self.job.stacks.set([self.python, Stack.objects.get(name="SQL")])
        Job.objects.create(source="t", external_id="2", url="https://x/2", title="Estágio Civil", company="B",
                           level="INTERNSHIP", area="ENGINEERING", state="SP", last_seen=now)
        Job.objects.create(source="t", external_id="3", url="https://x/3", title="Estágio Dev RJ", company="C",
                           level="INTERNSHIP", area="SOFTWARE", state="RJ", work_model="ON_SITE", last_seen=now)
        self.c = Client(enforce_csrf_checks=True)

    def call(self, method, url, data=None):
        token = self.c.cookies["csrftoken"].value if "csrftoken" in self.c.cookies else ""
        return getattr(self.c, method)(url, data, content_type="application/json", HTTP_X_CSRFTOKEN=token)

    def test_full_flow(self):
        creds = {"email": "Ana@Example.com", "password": "uma-senha-boa-123"}
        self.assertEqual(self.call("post", "/api/auth/signup", creds).status_code, 403)  # no CSRF yet
        self.c.get("/api/auth/csrf")
        self.assertEqual(self.call("post", "/api/auth/signup", creds).status_code, 201)
        self.assertEqual(self.call("get", "/api/auth/me").json(), {"email": "ana@example.com"})

        r = self.call("put", "/api/profile", {"areas": ["SOFTWARE"], "levels": ["INTERNSHIP"], "state": "sp",
                                               "stack_ids": [self.python.id], "salary_expectation": "1500"})
        self.assertEqual(r.status_code, 200, r.content)

        page = self.call("get", "/api/jobs").json()
        self.assertEqual([j["title"] for j in page["items"]], ["Estágio Python"])  # area + UF filters
        self.assertEqual(page["items"][0]["why"]["missing"], ["SQL"])

        self.assertEqual(self.call("get", "/api/radar").json()["stacks"][0]["name"], "SQL")

        card = self.call("post", "/api/applications", {"job_id": self.job.id}).json()
        self.assertEqual(self.call("post", "/api/applications", {"job_id": self.job.id}).status_code, 409)
        manual = self.call("post", "/api/applications", {"title": "Dev Jr", "company": "Amigo SA",
                                                          "url": "https://linkedin.com/x"})
        self.assertEqual(manual.status_code, 201)

        self.assertEqual(self.call("post", f"/api/applications/{card['id']}/analyze").status_code, 400)
        self.call("patch", f"/api/applications/{card['id']}", {"status": "INTERVIEW"})
        r = self.call("patch", f"/api/applications/{card['id']}", {"status": "REJECTED", "notes": "caí no SQL"})
        self.assertEqual(r.json()["rejected_at_stage"], "INTERVIEW")

        with patch("google.genai.Client") as client:
            client.return_value.models.generate_content.return_value.text = "Estude SQL."
            r = self.call("post", f"/api/applications/{card['id']}/analyze")
        self.assertEqual(r.json()["text"], "Estude SQL.")
        prompt = client.return_value.models.generate_content.call_args.kwargs["contents"]
        self.assertIn("Entrevista", prompt)
        self.assertIn("caí no SQL", prompt)

        self.assertEqual(len(self.call("get", "/api/applications").json()), 2)

        self.assertEqual(self.call("post", "/api/auth/delete", {"password": "errada"}).status_code, 401)
        self.assertEqual(self.call("post", "/api/auth/delete", {"password": creds["password"]}).status_code, 204)
        self.assertEqual(self.call("get", "/api/auth/me").status_code, 401)

    def test_other_users_cards_are_private(self):
        self.c.get("/api/auth/csrf")
        self.call("post", "/api/auth/signup", {"email": "a@x.com", "password": "uma-senha-boa-123"})
        card = self.call("post", "/api/applications", {"job_id": self.job.id}).json()
        self.call("post", "/api/auth/logout")
        self.c.get("/api/auth/csrf")
        self.call("post", "/api/auth/signup", {"email": "b@x.com", "password": "uma-senha-boa-123"})
        self.assertEqual(self.call("patch", f"/api/applications/{card['id']}", {"status": "OFFER"}).status_code, 404)


class CollectorSchedule(TestCase):
    def test_is_due(self):
        from datetime import timedelta

        from jobhunter.management.commands.collect import is_due
        from jobhunter.models import CollectorRun

        now = timezone.now()
        self.assertTrue(is_due("gupy", now))  # never ran
        run = CollectorRun.objects.create(source="gupy", status=CollectorRun.Status.OK)
        self.assertFalse(is_due("gupy", now + timedelta(hours=23)))
        self.assertTrue(is_due("gupy", now + timedelta(hours=24, minutes=1)))
        run.status = CollectorRun.Status.FAILED
        run.save()
        self.assertFalse(is_due("gupy", now + timedelta(hours=5)))
        self.assertTrue(is_due("gupy", now + timedelta(hours=6, minutes=1)))
