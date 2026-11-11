from django.conf import settings
from django.db import models


class Level(models.TextChoices):
    INTERNSHIP = "INTERNSHIP", "Estágio"
    TRAINEE = "TRAINEE", "Trainee"
    JUNIOR = "JUNIOR", "Júnior"


class Area(models.TextChoices):
    SOFTWARE = "SOFTWARE", "Software"
    DATA = "DATA", "Dados"
    INFRA = "INFRA", "Infra, redes e segurança"
    ENGINEERING = "ENGINEERING", "Engenharias"


class WorkModel(models.TextChoices):
    ON_SITE = "ON_SITE", "Presencial"
    HYBRID = "HYBRID", "Híbrido"
    REMOTE = "REMOTE", "Remoto"


class Contract(models.TextChoices):
    INTERNSHIP = "INTERNSHIP", "Estágio"
    CLT = "CLT", "CLT"
    PJ = "PJ", "PJ"


class Stack(models.Model):
    name = models.CharField(max_length=60, unique=True)
    # Regex fragments (lowercase) matched with word boundaries against job text.
    aliases = models.JSONField(default=list)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Job(models.Model):
    source = models.CharField(max_length=30)
    external_id = models.CharField(max_length=200)
    url = models.URLField(max_length=1000)
    title = models.CharField(max_length=300)
    company = models.CharField(max_length=200, db_index=True)
    company_logo = models.URLField(max_length=1000, blank=True)
    description = models.TextField(blank=True)
    level = models.CharField(max_length=15, choices=Level.choices)
    area = models.CharField(max_length=15, choices=Area.choices)
    contract = models.CharField(max_length=15, choices=Contract.choices, blank=True)
    work_model = models.CharField(max_length=15, choices=WorkModel.choices, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=2, blank=True)  # UF
    salary = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    stacks = models.ManyToManyField(Stack, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    deadline = models.DateTimeField(null=True, blank=True)
    first_seen = models.DateTimeField(auto_now_add=True)
    last_seen = models.DateTimeField()
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["source", "external_id"], name="unique_job_per_source")]
        indexes = [models.Index(fields=["closed_at", "area", "level"])]

    def __str__(self):
        return f"{self.title} — {self.company}"


class Profile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    areas = models.JSONField(default=list)
    levels = models.JSONField(default=list)
    work_models = models.JSONField(default=list)
    state = models.CharField(max_length=2, blank=True)
    city = models.CharField(max_length=100, blank=True)
    salary_expectation = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    stacks = models.ManyToManyField(Stack, blank=True)
    resume_text = models.TextField(blank=True)
    cv = models.JSONField(default=dict, blank=True)  # structured CV from the builder (api.Cv)
    cv_review = models.JSONField(default=dict, blank=True)  # last Gemini review (api.CvReview)
    last_seen_jobs_at = models.DateTimeField(null=True, blank=True)


class Application(models.Model):
    class Status(models.TextChoices):
        SAVED = "SAVED", "Salva"
        APPLIED = "APPLIED", "Aplicada"
        TEST = "TEST", "Teste/Case"
        INTERVIEW = "INTERVIEW", "Entrevista"
        OFFER = "OFFER", "Oferta"
        REJECTED = "REJECTED", "Reprovada"
        WITHDRAWN = "WITHDRAWN", "Desisti"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    job = models.ForeignKey(Job, on_delete=models.SET_NULL, null=True, blank=True)
    # Manual cards fill these; collected jobs copy them so the card survives without the job.
    title = models.CharField(max_length=300)
    company = models.CharField(max_length=200)
    url = models.URLField(max_length=1000, blank=True)
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.SAVED)
    # Status the card was in right before REJECTED: tells the analyst where the user fell.
    rejected_at_stage = models.CharField(max_length=15, choices=Status.choices, blank=True)
    notes = models.TextField(blank=True)
    salary = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    deadline = models.DateField(null=True, blank=True)  # application deadline; falls back to the job's
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "job"], condition=models.Q(job__isnull=False), name="one_card_per_job"
            )
        ]


class Analysis(models.Model):
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name="analyses")
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)


class CollectorRun(models.Model):
    class Status(models.TextChoices):
        RUNNING = "RUNNING", "Rodando"
        OK = "OK", "OK"
        FAILED = "FAILED", "Falhou"

    source = models.CharField(max_length=30)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.RUNNING)
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    fetched = models.IntegerField(default=0)
    new_jobs = models.IntegerField(default=0)
    error = models.TextField(blank=True)

    class Meta:
        ordering = ["-started_at"]
