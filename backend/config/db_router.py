# backend\config\db_router.py
class MultiDBRouter:
    APP_DB_MAP = {
        "auth": "default",
        "contenttypes": "default",
        "admin": "default",
        "sessions": "default",
        "messages": "default",
        "authentication": "default",
        "security": "default",
        "common": "azul",
        "operaciones": "default",
        "empleados": "default",
        "ia_dev": "default",
        "implementacion_fo": "default",
    }

    def db_for_read(self, model, **hints):
        if hasattr(model, "_database") and model._database:
            return model._database
        if model._meta.app_label == "common" and model._meta.model_name == "notificacioncorreo":
            return "default"
        return self.APP_DB_MAP.get(model._meta.app_label)

    def db_for_write(self, model, **hints):
        if hasattr(model, "_database") and model._database:
            return model._database
        if model._meta.app_label == "common" and model._meta.model_name == "notificacioncorreo":
            return "default"
        return self.APP_DB_MAP.get(model._meta.app_label)

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        if app_label == "common" and model_name == "notificacioncorreo":
            return db == "default"
        target_db = self.APP_DB_MAP.get(app_label)
        if target_db is None:
            return None
        return db == target_db

