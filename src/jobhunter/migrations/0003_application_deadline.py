from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("jobhunter", "0002_job_company_logo")]

    operations = [
        migrations.AddField(
            model_name="application",
            name="deadline",
            field=models.DateField(blank=True, null=True),
        ),
    ]
