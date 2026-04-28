from django import forms
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _
from unfold.admin import ModelAdmin, TabularInline

from .models import CustomUser, InternalUserRole


class AutoPasswordUserCreationForm(forms.ModelForm):
    """Admin user creation — leave passwords blank to auto-generate and email."""

    password1 = forms.CharField(
        label=_('Senha (opcional)'),
        widget=forms.PasswordInput(attrs={'autocomplete': 'new-password'}),
        required=False,
        help_text=_('Deixe em branco para gerar automaticamente e enviar por e-mail.'),
    )
    password2 = forms.CharField(
        label=_('Confirmação de senha (opcional)'),
        widget=forms.PasswordInput(attrs={'autocomplete': 'new-password'}),
        required=False,
    )

    class Meta:
        model = CustomUser
        fields = ('email', 'first_name', 'last_name', 'is_internal_staff')

    def clean(self):
        cleaned_data = super().clean()
        p1 = cleaned_data.get('password1', '')
        p2 = cleaned_data.get('password2', '')
        if (p1 or p2) and p1 != p2:
            raise forms.ValidationError(_('As senhas não coincidem.'))
        return cleaned_data

    def save(self, commit=True):
        user = super().save(commit=False)
        user.username = self.cleaned_data['email']
        password = self.cleaned_data.get('password1', '')
        if password:
            user.set_password(password)
            self._auto_generated = False
        else:
            from .email_service import generate_random_password
            auto_password = generate_random_password()
            user.set_password(auto_password)
            self._auto_password = auto_password
            self._auto_generated = True
        if commit:
            user.save()
        return user


class InternalUserRoleInline(TabularInline):
    model = InternalUserRole
    extra = 1
    fields = ('role', 'is_active', 'created_at', 'updated_at')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(CustomUser)
class CustomUserAdmin(BaseUserAdmin, ModelAdmin):
    add_form = AutoPasswordUserCreationForm
    inlines = [InternalUserRoleInline]

    list_display = ('email', 'first_name', 'last_name', 'is_internal_staff', 'is_active', 'date_joined')
    list_filter = ('is_internal_staff', 'is_active', 'is_staff', 'is_superuser', 'force_password_change')
    search_fields = ('email', 'first_name', 'last_name')
    ordering = ('-date_joined',)

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        (_('Informações Pessoais'), {'fields': ('first_name', 'last_name')}),
        (_('ALZ Info'), {'fields': ('is_internal_staff', 'microsoft_oauth_uid', 'force_password_change')}),
        (_('Segurança'), {
            'fields': ('last_login_ip', 'last_login'),
            'classes': ('collapse',),
        }),
        (_('Permissões'), {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        (_('Datas'), {'fields': ('date_joined',)}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'first_name', 'last_name', 'password1', 'password2', 'is_internal_staff'),
        }),
    )

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        if not change and getattr(form, '_auto_generated', False):
            from .email_service import send_welcome_email
            send_welcome_email(obj, form._auto_password)


@admin.register(InternalUserRole)
class InternalUserRoleAdmin(ModelAdmin):
    list_display = ('user', 'role', 'is_active', 'created_at')
    list_filter = ('role', 'is_active')
    search_fields = ('user__email', 'user__first_name', 'user__last_name')
    autocomplete_fields = ('user',)
