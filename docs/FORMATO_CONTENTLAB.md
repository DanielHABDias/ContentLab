# Formato `.contentlab`

`.contentlab` é um contêiner ZIP sem perdas com layout próprio:

```text
contentlab-manifest.json
blobs/<sha256>
```

O manifesto `contentlab-package-v1` mapeia cada caminho lógico do projeto para hash, tamanho e modo. Blobs iguais são armazenados uma vez. O nível Deflate é configurável de 0 a 9; mídia já comprimida tende a ganhar pouco, portanto não é recomprimida com perdas. O relatório de exportação informa arquivos, blobs, bytes e duração real.

## Conteúdo

Um pacote completo inclui `project.json`, versões/histórico, roteiro e metadados, thumbnails, legendas, timeline, componentes e recursos referenciados. Cache e render final entram apenas quando o perfil de exportação os inclui. A exportação enxuta seleciona vídeo final, metadados e arte aprovada. ZIP padrão mantém os arquivos em seus caminhos comuns e serve para interoperabilidade.

## Extração e restauração

Antes de escrever, o Content Lab valida schema, caminhos, duplicatas, hashes, tamanhos e presença de todos os blobs. Caminhos absolutos, segmentos `..`, NUL, symlinks e entradas duplicadas são rejeitados. Arquivos existentes não são sobrescritos. A restauração cria uma pasta escolhida pelo usuário e só então pode ser aberta como projeto.

CLI/MCP devem oferecer `package.export`, `package.inspect` e `package.restore` sobre este mesmo serviço. Envio externo é responsabilidade de um agente autorizado e não altera o pacote nem publica em redes sociais.
