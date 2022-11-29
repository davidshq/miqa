from uuid import uuid4
from django.db import models

class SettingsGroup(models.Model):
    """Models a group containing settings

        Allows one to reference a specific grouping of settings.
    """
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    def __str__(self):
        return str(self.name)
