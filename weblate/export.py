"""Flush pending edits and export the actual repository JSON, not a format conversion."""
import json
from pathlib import Path
from weblate.trans.models import Component

component = Component.objects.get(project__slug="plural-playground", slug="i18next-v4")
component.commit_pending("local export", None, skip_push=True)
root = Path(component.repository.path)
print(json.dumps({lang: (root / f"src/locales/{lang}/translation.json").read_text()
                  for lang in ("en", "lt")}, ensure_ascii=False))
