/** Maps domain/application error codes to pt-BR messages. Unknown codes fall back to a generic message. */
const MESSAGES: Readonly<Record<string, string>> = {
  INVALID_QUANTITY: "Quantidade de ingressos inválida.",
  EVENT_NOT_FOUND: "Evento não encontrado.",
  EVENT_NOT_ON_SALE: "As vendas para este evento estão encerradas.",
  SOLD_OUT: "Ingressos esgotados para a quantidade escolhida.",
  PAYMENT_UNAVAILABLE: "Não foi possível gerar o Pix agora. Tente novamente em instantes.",
  TEST_MODE_DISABLED: "Simulação de pagamento indisponível.",
  ORDER_NOT_PAYABLE: "Este pedido não pode mais ser pago.",
  INVALID_TITLE: "Informe um título entre 3 e 120 caracteres.",
  INVALID_DESCRIPTION: "A descrição pode ter no máximo 2000 caracteres.",
  STARTS_IN_THE_PAST: "Informe uma data futura para o evento.",
  INVALID_CAPACITY: "Informe uma capacidade válida.",
  INVALID_PRICE: "Informe um preço válido maior que zero.",
  INVALID_BANNER: "Banner inválido: envie JPG, PNG ou WebP de até 2 MB.",
  EVENT_NOT_DRAFT: "Somente rascunhos podem ser publicados.",
  EVENT_ALREADY_CLOSED: "Este evento já está encerrado.",
  TICKET_NOT_FOUND: "Ingresso inválido para este evento.",
  ALREADY_CHECKED_IN: "Ingresso já utilizado.",
};

const GENERIC_ERROR = "Algo deu errado. Tente novamente.";

export function messageFor(code: string | undefined | null): string | null {

  if (!code) {
    return null;
  }

  return MESSAGES[code] ?? GENERIC_ERROR;
}
