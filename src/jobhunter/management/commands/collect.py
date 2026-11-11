import time
import traceback
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from jobhunter.collectors import sources
from jobhunter.matching import classify
from jobhunter.models import CollectorRun, Job, Stack
from jobhunter.stacks import sync_stacks

DAY = timedelta(hours=24)
RETRY = timedelta(hours=6)


def is_due(source, now):
    """Schedule lives in the DB, so restarting the container (every deploy) doesn't trigger extra collections."""
    last = CollectorRun.objects.filter(source=source).order_by("-started_at").first()
    if not last:
        return True
    wait = DAY if last.status == CollectorRun.Status.OK else RETRY  # FAILED, or RUNNING cut off by a restart
    return now - last.started_at >= wait


def run_source(name, module):
    run = CollectorRun.objects.create(source=name)
    started = timezone.now()
    try:
        raw = module.fetch()
        stacks = list(Stack.objects.all())
        for r in raw:
            item = classify(r, stacks)
            if not item:
                continue
            found = item.pop("stacks")
            item["title"], item["company"] = item["title"][:300], item["company"][:200]
            job, created = Job.objects.update_or_create(
                source=name,
                external_id=item.pop("external_id"),
                defaults={**item, "last_seen": started, "closed_at": None},
            )
            job.stacks.set(found)
            run.new_jobs += created
        run.fetched = len(raw)
        grace = timedelta(days=getattr(module, "CLOSE_AFTER_DAYS", 0))
        Job.objects.filter(source=name, closed_at=None, last_seen__lt=started - grace).update(closed_at=started)
        run.status = CollectorRun.Status.OK
    except Exception:
        run.status, run.error = CollectorRun.Status.FAILED, traceback.format_exc()
    run.finished_at = timezone.now()
    run.save()
    return run


def run_many(names, log):
    sync_stacks()
    all_sources = sources()
    failed = []
    for name in names:
        run = run_source(name, all_sources[name])
        log(f"{name}: {run.status} fetched={run.fetched} new={run.new_jobs}")
        if run.status == CollectorRun.Status.FAILED:
            log(run.error.strip().splitlines()[-1])
            failed.append(name)
    # Deadlines pass between runs regardless of source.
    Job.objects.filter(closed_at=None, deadline__lt=timezone.now()).update(closed_at=timezone.now())
    return failed


class Command(BaseCommand):
    help = "Collect jobs from all sources (or --source X). --loop: once a day, retrying failed sources every 6h."

    def add_arguments(self, parser):
        parser.add_argument("--source", action="append", help="Only this source (repeatable)")
        parser.add_argument("--loop", action="store_true")

    def handle(self, *args, source=None, loop=False, **opts):
        names = source or list(sources())
        if not loop:
            run_many(names, self.stdout.write)
            return
        while True:
            now = timezone.now()
            if due := [n for n in names if is_due(n, now)]:
                run_many(due, self.stdout.write)
            time.sleep(15 * 60)
