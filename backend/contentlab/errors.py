class ContentLabError(Exception):
    """Erro esperado e apresentável ao usuário."""


class PlanValidationError(ContentLabError):
    def __init__(self, issues):
        self.issues = list(issues)
        super().__init__("Plano de edição inválido.")


class UnsafeAssetPathError(ContentLabError):
    """Uma URI tentou escapar da raiz autorizada."""
