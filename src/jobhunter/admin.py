from django.contrib import admin

from .models import Analysis, Application, CollectorRun, Job, Profile, Stack


@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    list_display = ("title", "company", "source", "level", "area", "state", "work_model", "salary", "first_seen", "closed_at")
    list_filter = ("source", "level", "area", "work_model", "state", ("closed_at", admin.EmptyFieldListFilter))
    search_fields = ("title", "company")
    filter_horizontal = ("stacks",)


@admin.register(CollectorRun)
class CollectorRunAdmin(admin.ModelAdmin):
    list_display = ("source", "status", "started_at", "finished_at", "fetched", "new_jobs")
    list_filter = ("source", "status")


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ("title", "company", "user", "status", "updated_at")
    list_filter = ("status",)


admin.site.register([Stack, Profile, Analysis])
