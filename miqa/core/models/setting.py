from uuid import uuid4
from django.db import models
from django.db.models import Q

class Setting(models.Model):
    """Models an individual setting"""
    class Meta:
        ordering = ('key',)

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    key = models.CharField(max_length=255, blank=False)
    value = models.TextField(blank=True)
    type = models.ForeignKey('self', blank=True, on_delete=models.SET_NULL,
                              null=True, limit_choices_to={'is_type': True}, related_name='base_type')
    group = models.ForeignKey('self', blank=True, on_delete=models.SET_NULL,
                              related_name='setting_group',
                              null=True, limit_choices_to=Q(type__key__exact='Group Type') | Q(type__key__exact='Group'))
    is_type = models.BooleanField(blank=True, null=False, default=False)

    def __str__(self):
        return str(self.key)
