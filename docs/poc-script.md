# Roteiro da PoC (para a Arena CB testar de ponta a ponta)

Ambiente: `https://arena-cb-tickets.<conta>.workers.dev`. Ele fica em **modo teste**, então nenhum dinheiro real é cobrado.

Você vai precisar de:
- o celular do admin, logado na conta Google cadastrada em `ADMIN_EMAILS`;
- um segundo celular, de um comprador com qualquer conta Google.

| # | Quem | Passo | Resultado esperado |
|---|---|---|---|
| 1 | Admin | Entrar → Admin → **+ Novo evento**: "Sertanejo Sexta", R$20,00, capacidade 5, banner opcional → **Criar rascunho** → **Publicar** | O evento aparece como "À venda" |
| 2 | Admin | **Compartilhar no Instagram/WhatsApp** | O link abre com título, data, preço e imagem (logo ou banner) |
| 3 | Comprador | Abrir o link → **Continuar com o Google** → quantidade 2 → **Pagar com Pix** | A tela mostra o QR Code e o "copia e cola" |
| 4 | Comprador | Pagar o Pix de teste (aprovado automaticamente pelo sandbox) ou tocar em **Simular pagamento (teste)** | Em até ~5 s aparece "Pagamento confirmado!" |
| 5 | Comprador | **Meus ingressos** | 2 ingressos, cada um com QR Code e status "Válido" |
| 6 | Admin | Abrir o evento | 2/5 reservados, 2 pagos, lista com o comprador; **Baixar CSV** abre no Excel |
| 7 | Admin | **Check-in na portaria** → **Abrir câmera** → escanear o 1º ingresso | "Entrada liberada ✅" |
| 8 | Admin | Escanear o mesmo ingresso de novo | "Ingresso já utilizado em …" |
| 9 | Comprador | Tentar comprar 4 ingressos | A tela de compra só oferece até 3 (restantes) |
| 10 | Comprador | Gerar um Pix e não pagar | Após 30 min o pedido expira e a vaga volta |

Observação: no iPhone, a leitura pela câmera depende do suporte do navegador. Se não funcionar, digite o código mostrado abaixo do QR.

## Ir para produção (go-live)

1. A Arena abre a conta PJ no Mercado Pago e gera as credenciais de produção.
2. `wrangler secret put MP_ACCESS_TOKEN` e `wrangler secret put MP_WEBHOOK_SECRET` com as credenciais de produção.
3. Em `wrangler.jsonc`, mudar `PAYMENT_TEST_MODE` para `"false"` e fazer o deploy.
4. Opcional: apontar um domínio `.com.br` próprio e atualizar `APP_URL` e as origens do Google OAuth.
