from uuid import uuid4
from django.db import models

class Setting(models.Model):
    """Models an individual setting"""

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    key = models.CharField(max_length=255, blank=False)
    value = models.TextField(blank=True)
    type = models.ForeignKey('self', blank=True, on_delete=models.SET_NULL,
        null=True, limit_choices_to={'is_type': True})
    group = models.ForeignKey('SettingsGroup', blank=True, on_delete=models.SET_NULL,
        null=True, related_name='settings')
    is_type = models.BooleanField(blank=True, null=False, default=False)

    def __str__(self):
        return str(self.key)
