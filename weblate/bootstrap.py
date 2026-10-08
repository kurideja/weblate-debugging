"""Run inside Weblate with: weblate shell < /fixtures/scripts/bootstrap.py."""
import subprocess
import os
from pathlib import Path

from django.test.utils import override_settings
from weblate.lang.models import Language
from weblate.trans.models import Component, Project
from weblate.vcs.git import GitRepository

# The Docker image disables plain Git transport by default. Enable it for this
# local fixture; Weblate's private-host allowlist is limited to `repository`.
git_home = Path(GitRepository._getenv()["HOME"])
git_home.mkdir(parents=True, exist_ok=True)
subprocess.run(["git", "config", "--file", str(git_home / ".gitconfig"),
                "protocol.git.allow", "always"], check=True)

project, _ = Project.objects.get_or_create(
    slug="plural-playground",
    defaults={"name": "Plural playground", "web": "http://localhost:5173"},
)
component = Component.objects.filter(project=project, slug="i18next-v4").first()
if component is None:
    # Complete the initial import synchronously so errors are visible here.
    with override_settings(CELERY_TASK_ALWAYS_EAGER=True):
        component = Component.objects.create(
            project=project,
            slug="i18next-v4",
            name="i18next JSON v4",
            vcs="git",
            repo="git://repository/repository",
            branch="main",
            filemask="src/locales/*/translation.json",
            template="src/locales/en/translation.json",
            file_format="i18nextv4",
            source_language=Language.objects.get(code="en"),
            push_on_commit=False,
            push="git://repository/repository",
        )
elif component.repo != "git://repository/repository":
    component.repo = "git://repository/repository"
    with override_settings(CELERY_TASK_ALWAYS_EAGER=True):
        component.save()

if component.translation_set.filter(language__code="lt").count() == 0:
    with override_settings(CELERY_TASK_ALWAYS_EAGER=True):
        component.after_save(changed_git=True, changed_setup=True, changed_template=False,
                             changed_variant=False, changed_enforced_checks=False,
                             skip_push=True, create=True)

if component.push != component.repo:
    component.push = component.repo
    component.push_on_commit = False
    with override_settings(CELERY_TASK_ALWAYS_EAGER=True):
        component.save()
for translation in component.translation_set.select_related("language"):
    print(f"{translation.language.code}: {translation.unit_set.count()} strings")
print("Manual pushes enabled to git://repository/repository (local Docker service).")
print(f"Open http://localhost:{os.environ.get('WEBLATE_PORT', '8080')}/projects/plural-playground/i18next-v4/")
