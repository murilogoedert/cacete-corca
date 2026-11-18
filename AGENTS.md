# AGENTS.md

Instruções para agentes que forem mexer neste repositório. Só a versão do Fable (`fable/`) recebeu as mudanças descritas aqui; `opus/` está como veio.

## Montar e rodar

- Edite em `fable/source/` e monte com `node fable/source/build.mjs`. Ele reescreve `fable/index.html`; nunca edite o `index.html` à mão.
- `index.html` na raiz do repositório é uma cópia de `fable/index.html`. Depois de montar, copie de novo.
- Os arquivos de `source/js/` entram na página em ordem de nome, dentro de uma única função. Nada é global de `window`, a não ser `__cap`.
- Os fontes estão em CRLF neste checkout (`core.autocrlf=true`). Substituição de texto com `\n` literal falha: normalize para LF, edite e devolva o CRLF.
- Precisa de WebGPU: Chrome ou Edge no computador.

## O que não pode mudar: a física do Uno

A volta roteirizada (`F`), o benchmark (`B`) e três das poses reproduzem teclas gravadas com o Uno. Qualquer mudança numérica na física dele desalinha a gravação.

- Todo comportamento novo entra atrás de um parâmetro que vale zero no Uno (`rwd`, `tc`, `dynBias`, `fly`), de modo que a conta do Uno continue a mesma, operação por operação.
- Depois de mexer em `40_vehicle.js` ou `45_game.js`, confira: 3600 quadros da volta roteirizada têm de terminar em `x = 22.429701062799808`, `z = -3.290716028261766`, última volta `55.21650719724312` (script `tools/cdp.mjs`, abaixo).
- A interface troca para o Uno e desliga o modo voador antes de qualquer reprodução (`uiUse(0)` em `52_ui.js`). Mantenha isso em qualquer caminho novo que ligue `GS.replayOn`.

## Como os carros estão organizados

- `30_car_a_shape.js`: a pele paramétrica. As funções de forma consultam `CK`; `null` é o Uno, com os números originais.
- `30_car_e_extras.js`: `CARDEFS` (lista de carros), a definição do Chevette (`CHV`) e os construtores genéricos de carroceria e peças.
- `30_car_d_main.js`: constrói uma malha por carro; todos usam os mesmos slots e `CAR.select(i)` troca as listas de desenho.
- `40_vehicle.js`: `VCARS[i]` são os parâmetros de física por carro, copiados para `VP` por `vehicleSetCar(i)`.
- `mat_car.wgsl`: `F.car.w` é o índice do carro; escolhe a cor da pintura e os detalhes desenhados sobre ela. `F.car2.yzw` leva as medidas da sombra de contato (`light.wgsl`).

Para acrescentar um carro: uma entrada em `CARDEFS`, uma em `VCARS` (mesma ordem), a cor em `mat_car.wgsl` e, se tiver placa ou emblema, o desenho em `carAtlasExtras`.

Armadilhas já encontradas na forma:

- O perfil `yt(x)` é uma função de x: face que se inclina para a frente não cabe; use face quase vertical.
- Se o abaulamento em planta (`bulge`) não for zero na frente e na traseira, o centro da face não desce até a saia e fica um buraco sob o para-choque. O Uno esconde isso com o para-choque inteiriço.
- O interior é o do Uno deslocado (`dx`, `dy`, `rs`). Num sedã, confira que o encosto do banco traseiro não fura a tampa do porta-malas.
- O forro interno é desenhado com a face para dentro; uma prévia sem descarte de faces mostra ele por cima das rodas e engana.
- A cor da pintura é albedo linear sob sol forte: vermelho acima de ~0,25 lava para salmão.

## Verificar sem abrir o jogo

- `node fable/tools/preview.mjs fable/source <pasta de saída> 0,1`: constrói as malhas em Node, sem GPU, e grava PNGs em seis vistas. Serve para forma e proporção; não mostra o que é desenhado no shader (frisos, cor real, lanternas).
- `node --experimental-websocket fable/tools/cdp.mjs "<url>" <script.mjs> <pasta>`: abre o Chrome sem janela com WebGPU, espera `__cap.ready()` e roda um script que recebe `ev` (avalia JS na página) e `save` (grava imagem).
- Parâmetros de URL úteis: `?cap=1` (sem laço próprio, avança com `__cap.frames(n)`), `&ui=1` (liga menu e teclas no modo de captura), `&car=1` (começa no Chevette), `&auto` (piloto automático), `&res=640x360`.
- `__cap.state()`, `__cap.VEH`, `__cap.GS` e `__cap.shot()` dão estado e imagem. Teclas: `dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyY' }))`.
- O piloto automático foi calibrado para o Uno. Com outro carro ele serve para pegar NaN e travamento, não para julgar dirigibilidade: os resultados variam muito de uma calibragem para outra.

## Física do Chevette: o que cada parâmetro resolveu

- `rwd: 1`: o torque vai para as rodas traseiras; o giro do motor é lido delas.
- `spinLat: 0.6`: aderência lateral que sobra na roda que patina (Uno: 0,42).
- `tc: 0.62`: em curva, limita a tração a essa fração da aderência traseira, proporcional à aceleração lateral. Existe porque o acelerador do teclado é tudo ou nada. Ajustável no jogo com `↑` `↓`.
- `dynBias: 1`: cada roda freia na proporção da carga vertical do instante. Com distribuição fixa, a traseira travava e soltava na entrada da curva.
- Freio-motor pela metade na tração traseira.

## Mapas

- `TRK.map` vem de `?mapa=N` (0 = Serra da Mata, 1 = Spa-Francorchamps em tamanho real, 7 km). O cenário inteiro é gerado na carga a partir de `TRK`, então a tecla `P` recarrega a página com o outro mapa (e o mesmo carro, `&car=`); não há troca a quente.
- Spa fica em `10_track_b_spa.js`: eixo tirado do SVG oficial (400 pontos, gerados por script a partir de `path2840`), relevo por fração da volta (`SPA_ELEV`), curvas detectadas pela curvatura (`spaSegs`) e relevo regional que acompanha a pista (`spaReg`). Zebras, brita, guard-rails, boxes, arquibancada e mata são os geradores de sempre.
- O mapa 0 tem de continuar idêntico: tudo que é de Spa entra atrás de `if (TRK.map)`.
- Em Spa não há volta roteirizada, benchmark nem poses (foram gravados no mapa 0). As câmeras de TV e alguns adereços usam posições fixas do mapa 0 e cobrem só o começo da volta.
- Spa carrega em ~13 s (medido sem janela); o desempenho em tela cheia não foi medido.
- Limites de pista (`trackLimits`, `45_game.js`): quatro rodas fora (asfalto, zebra e faixa dos boxes valem) ou qualquer roda na brita invalidam a volta; o painel pinta o tempo de vermelho e a volta não vira melhor volta.

## Teclas acrescentadas

| Tecla | O que faz |
|---|---|
| `Y` (controle: `LB`) | troca de carro, no lugar e na velocidade atuais |
| `↑` `↓` | Chevette: tração em curva (`tc`). Não aceleram nem freiam mais; use `W` e `S` |
| `Backspace` | modo voador; no ar `↓` sobe e `↑` desce |
| `P` | troca de mapa (recarrega a página) |
| `C` | passou a ter uma quarta câmera: a do piloto, atrás do volante (`GS.cam === 3`, olho em `GS.eye`) |

O minimapa (`mmInit` / `mmFrame`, `52_ui.js`) é um canvas desenhado uma vez mais um ponto movido por CSS.

## Publicação

- Fork: `github.com/murilogoedert/cacete-corca` (remoto `fork`). GitHub Pages serve a raiz do ramo principal: `https://murilogoedert.github.io/cacete-corca/` abre o `index.html` da raiz.
- Por isso, depois de montar, copie `fable/index.html` para a raiz antes de commitar.

O modo voador (`vehicleFlyStep`) é um modelo separado e simples: sem colisão no ar, altura medida sobre o relevo, teto de 150 m. Volta feita com ele ligado não entra no cronômetro.

## Preferências de quem mantém

- Responder em português.
- Mensagens de commit sem linha de coautoria.
- Pedidos de ajuste de física são só de física: não revisitar o modelo 3D junto.
- Há um Gol quadrado 1986 azul, de tração dianteira, pedido e adiado. A estrutura de `CARDEFS` já comporta.
