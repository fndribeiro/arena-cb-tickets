# Custos: Sympla vs. sistema próprio

Premissas:
- desenvolvimento sem custo;
- compara-se só taxa + hospedagem + manutenção;
- valores de outubro/2026, a confirmar nos sites oficiais.

| Item | Sympla | Arena CB Tickets (Mercado Pago Pix) |
|---|---|---|
| Taxa por ingresso de R$20 | R$2,50 (10%, mínimo R$2,50) | ~R$0,20 (~0,99%) |
| Hospedagem | incluída | R$0 (Cloudflare Workers Free) |
| Domínio | — | R$0 na PoC (`*.workers.dev`); ~R$40/ano com `.com.br` |

## Cenário: 4 eventos/mês × 300 pessoas × R$20

São 1.200 ingressos e R$24.000 vendidos por mês.

| | Sympla | Próprio |
|---|---|---|
| Taxa/mês | R$3.000,00 | R$237,60 |
| Infra/mês | — | R$0 a R$3,40 |
| **Total/mês** | **R$3.000** | **~R$241 (−92%)** |
| **Total/ano** | **R$36.000** | **~R$2.900** |

- **Plano pago:** se o volume passar do plano grátis, o Workers Paid custa US$5/mês (~R$28), e a economia continua em ~91%.
- **Manutenção paga:** o teto que ainda mantém −50% é ~R$1.259/mês nesse cenário.

## Fontes

- [Sympla — taxas](https://www.sympla.com.br/plataforma-de-eventos-maior-do-brasil)
- [Mercado Pago — taxa Pix](https://www.mercadopago.com.br/blog/evitar-cobranca-taxa-pix)
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [D1 — limites do plano grátis](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/)
