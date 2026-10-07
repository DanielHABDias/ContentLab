class ContentLabError(Exception):
    """Erro esperado e apresentável ao usuário."""


class PlanValidationError(ContentLabError):
    def __init__(self, issues):
        self.issues = list(issues)
        super().__init__("Plano de edição inválido.")


class UnsafeAssetPathError(ContentLabError):
    """Uma URI tentou escapar da raiz autorizada."""


class RenderError(ContentLabError):
    """O backend de render não conseguiu produzir a saída."""


class RenderCancelled(ContentLabError):
    """O usuário cancelou o render em andamento."""
