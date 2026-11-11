---
name: contentlab-packages
description: Inspecionar, exportar ou restaurar pacotes `.contentlab` e ZIP do Content Lab com integridade e extração segura. Use para portabilidade, backup local ou entrega; não envie arquivos a serviços externos sem autorização específica.
---

# Pacotes Content Lab

Leia [formato e perfis](references/formato.md) apenas quando precisar escolher conteúdo ou explicar a estrutura.

- Para exportar, escolha uma origem e destino explícitos. Use `.contentlab` para projeto restaurável e ZIP para interoperabilidade.
- Use nível Deflate 6 por padrão. Nível 0 evita compressão; 9 prioriza tamanho sobre CPU. Não prometa redução para MP4/JPEG já comprimidos.
- Inspecione o pacote antes de restaurar. Confirme schema, quantidade de arquivos/blobs e destino.
- Restaure em diretório vazio ou novo. O serviço recusa sobrescrita, traversal, symlinks, duplicatas e hash/tamanho divergentes.
- Leia de volta `project.json` e os artefatos esperados. Reporte caminho, arquivos, bytes e duração fornecidos pela ferramenta.
- Excluir pacotes ou enviá-los ao Drive requer pedido explícito; exportar não concede essa autorização.
