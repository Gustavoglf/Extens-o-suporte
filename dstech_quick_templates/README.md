# DSTech - Respostas rápidas (Chrome)

Versão 1.1.0 — extensão Manifest V3 preparada para Google Chrome 146.0.7680.177 ou superior. O script é injetado em páginas de qualquer domínio e também em iframes compatíveis, em vez de ficar limitado a uma lista de sites.

## O que vem nesta versão

- Botão discreto fixo no canto superior direito da página.
- Aba **OS**: 38 modelos da seção **ATENDIMENTO** do documento original. O manual não contém uma lista separada de descrições para abertura de OS; por isso, essa aba reúne os modelos de registro de atendimento disponíveis.
- Aba **Omini**: 17 modelos de mensagens para o cliente.
- Pesquisa por título ou pelo conteúdo (os resultados mostram apenas os títulos).
- Remove os colchetes externos e os espaços em branco do início/fim do texto.
- Preserva as quebras de linha e os espaços internos dos modelos.
- Tenta inserir no cursor/seleção atual em campos `input`, `textarea`, `contenteditable`, editores ricos conhecidos e campos com `role="textbox"`.
- Não envia mensagens automaticamente.
- Os modelos ficam dentro da própria extensão. Não há servidor, conta ou transmissão dos textos para terceiros.

## O que mudou na versão 1.1.0

- Alterado o padrão de correspondência para `<all_urls>`, permitindo a injeção em sites HTTP, HTTPS e outros esquemas suportados pelo Chrome.
- Habilitada a injeção em todos os frames e em frames relacionados `about:`, `data:`, `blob:` e `filesystem:` por meio de `match_origin_as_fallback`.
- O botão agora fica disponível no canto superior direito mesmo antes de clicar em um campo.
- Ampliada a identificação de campos de texto e editores ricos, com suporte adicional a `role="textbox"`, `aria-multiline`, ProseMirror, Quill, Lexical, Slate, CodeMirror e Monaco (quando utilizam um campo editável acessível ao script).
- Melhorada a restauração da posição do cursor antes da inserção.

## Como instalar no Google Chrome

1. Baixe o ZIP desta versão e extraia o conteúdo para uma pasta, por exemplo `dstech_quick_templates`.
2. Abra o Google Chrome e digite `chrome://extensions` na barra de endereços.
3. Remova a versão anterior da DSTech (ou desative-a e carregue esta versão em outra pasta, para evitar duas cópias simultâneas).
4. Ative **Modo do desenvolvedor**, no canto superior direito.
5. Clique em **Carregar sem compactação**.
6. Selecione a pasta extraída `dstech_quick_templates` — ela precisa conter diretamente o arquivo `manifest.json`.
7. Recarregue as páginas já abertas do Omini e do Hubsoft.

Não é necessário executar servidor, instalar Node.js ou manter o VS Code aberto.

## Como usar

1. Abra qualquer página comum da Web.
2. O botão azul com a letra **D** ficará no canto superior direito.
3. Clique no campo em que deseja inserir o texto.
4. Clique no botão **D**, escolha **OS** ou **Omini** e selecione um título.
5. O texto será inserido na posição do cursor ou substituirá o trecho selecionado.
6. Revise os campos variáveis (por exemplo, `XXX`, `XXXX`, `XX/XX` e `Mbps`) e envie a mensagem ou salve o registro manualmente.

O painel permanece aberto depois de inserir um modelo, permitindo inserir outro em sequência. Clique no **×** ou pressione `Esc` para fechar.

## Como editar ou adicionar modelos

1. Abra a pasta da extensão no Visual Studio Code ou em outro editor de texto.
2. Abra `templates.json`.
3. Dentro de `ATENDIMENTO`, edite/adicione modelos de registro; dentro de `OMINI`, edite/adicione respostas ao cliente.
4. Cada modelo segue este formato:

```json
{
  "title": "TÍTULO QUE APARECE NA LISTA",
  "text": "Texto completo que será inserido.\\nUma segunda linha, se necessário."
}
```

5. Salve o arquivo, volte para `chrome://extensions`, clique em atualizar e recarregue a página.

## Compatibilidade e limitações

- Versão mínima declarada no manifesto: Google Chrome `146.0.7680.177`.
- A extensão é injetada em páginas correspondentes a `<all_urls>` e tenta detectar campos em todos os frames.
- O Chrome não permite executar extensões em páginas internas/protegidas como `chrome://extensions`, na Chrome Web Store, na página de nova guia e em alguns visualizadores protegidos. Páginas `file://` podem exigir habilitar **Permitir acesso a URLs de arquivos** nas configurações da extensão.
- Alguns sistemas usam editores proprietários, editores em canvas ou áreas de digitação encapsuladas de forma que extensões não consigam manipular diretamente. Nesses casos, o botão pode aparecer, mas a inserção ainda pode exigir um adaptador específico para o editor.
- `match_origin_as_fallback` amplia a cobertura de iframes criados por páginas compatíveis, mas não remove as restrições de segurança do Chrome nem concede acesso a páginas bloqueadas pelo navegador.
- A compatibilidade precisa ser confirmada nos campos reais do Hubsoft e do Omini após a instalação. Se o botão aparecer mas o texto não entrar, teste clicar diretamente dentro do campo, posicionar o cursor e selecionar o modelo novamente.

## Arquivos

- `manifest.json`: configuração da extensão e permissões de correspondência de páginas.
- `content.js`: botão, painel, pesquisa, detecção do campo ativo e inserção.
- `styles.css`: aparência do painel.
- `templates.json`: os 55 modelos extraídos do manual.
- `icon*.png`: ícones da extensão.
