from django.conf import settings
from django.db import models


class Company(models.Model):

    name = models.CharField(max_length=100)
    sector = models.CharField(max_length=100)
    number_of_employees = models.IntegerField()

    class Meta:
        verbose_name = "Empresa"
        verbose_name_plural = "Empresas"


class Stack(models.Model):

    name = models.CharField(max_length=100)
    description = models.TextField()


class JobPosting(models.Model):
    
    class Seniority(models.TextChoices):
        JUNIOR = "JUNIOR", "Júnior"
        MID_LEVEL = "MID_LEVEL", "Pleno"
        SENIOR = "SENIOR", "Sênior"
        
    class EmploymentType(models.TextChoices):
        CLT = "CLT", "CLT"
        PJ = "PJ", "PJ"
        FREELANCE = "FREELANCE", "Freelancer"
        
    class WorkModel(models.TextChoices):
        ON_SITE = "ON_SITE", "Presencial"
        REMOTE = "REMOTE", "Remoto"
        HYBRID = "HYBRID", "Híbrido"

    title = models.CharField(max_length=100)
    description = models.TextField()
    employment_type = models.CharField(max_length=15, choices=EmploymentType.choices)
    work_model = models.CharField(max_length=15, choices=WorkModel.choices)
    seniority = models.CharField(max_length=15, choices=Seniority.choices)
    salary = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    stacks = models.ManyToManyField(Stack)
    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    published_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(blank=True, null=True)


class Application(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pendente"
        APPROVED = "APPROVED", "Aprovado"
        REJECTED = "REJECTED", "Reprovado"

    job_posting = models.ForeignKey(JobPosting, on_delete=models.CASCADE)
    applicant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    applied_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.PENDING)