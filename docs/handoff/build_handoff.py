"""Generates docs/handoff/arena-cb-tickets-handoff.pdf (client-facing handoff, pt-BR).

Usage: python3.13 -m venv .venv && .venv/bin/pip install reportlab && .venv/bin/python docs/handoff/build_handoff.py
"""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Image,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "docs" / "handoff" / "arena-cb-tickets-handoff.pdf"
LOGO = ROOT / "public" / "logo.jpg"

APP_URL = "https://arena-cb-tickets.arena-cb-tickets.workers.dev"
REPO_URL = "https://github.com/fndribeiro/arena-cb-tickets"
DOC_DATE = "01/11/2026"

INK = colors.HexColor("#111114")
MUTED = colors.HexColor("#5b5b66")
PURPLE = colors.HexColor("#8b3fe4")
PINK = colors.HexColor("#e0409a")
TEAL = colors.HexColor("#17a37f")
ORANGE = colors.HexColor("#d98a0b")
LINE = colors.HexColor("#dcdce3")
SOFT = colors.HexColor("#f4f1fb")

PAGE_MARGIN = 18 * mm


def build_styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("title", parent=base["Title"], fontName="Helvetica-Bold", fontSize=26, leading=31, textColor=INK, alignment=TA_CENTER),
        "subtitle": ParagraphStyle("subtitle", parent=base["Normal"], fontSize=13, leading=18, textColor=MUTED, alignment=TA_CENTER),
        "h1": ParagraphStyle("h1", parent=base["Heading1"], fontName="Helvetica-Bold", fontSize=17, leading=21, textColor=PURPLE, spaceBefore=6, spaceAfter=8),
        "h2": ParagraphStyle("h2", parent=base["Heading2"], fontName="Helvetica-Bold", fontSize=12.5, leading=16, textColor=INK, spaceBefore=10, spaceAfter=4),
        "body": ParagraphStyle("body", parent=base["Normal"], fontName="Helvetica", fontSize=10.2, leading=14.5, textColor=INK, spaceAfter=6),
        "small": ParagraphStyle("small", parent=base["Normal"], fontName="Helvetica", fontSize=8.6, leading=11.5, textColor=MUTED),
        "cell": ParagraphStyle("cell", parent=base["Normal"], fontName="Helvetica", fontSize=9.2, leading=12.2, textColor=INK),
        "cell_bold": ParagraphStyle("cell_bold", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=9.2, leading=12.2, textColor=INK),
        "head": ParagraphStyle("head", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=9.2, leading=12.2, textColor=colors.white),
        "callout": ParagraphStyle("callout", parent=base["Normal"], fontName="Helvetica", fontSize=10, leading=14, textColor=INK),
    }


S = build_styles()


def p(text, style="body"):
    return Paragraph(text, S[style])


def bullets(items, numbered=False):
    flow_items = [ListItem(p(item), leftIndent=12, value=None) for item in items]
    return ListFlowable(
        flow_items,
        bulletType="1" if numbered else "bullet",
        start="1" if numbered else None,
        bulletFontName="Helvetica-Bold" if numbered else "Helvetica",
        bulletFontSize=9.5,
        bulletColor=PURPLE,
        leftIndent=14,
        spaceAfter=4,
    )


def table(rows, widths, header=True, zebra=True):
    styled_rows = []
    for row_index, row in enumerate(rows):
        style = "head" if header and row_index == 0 else "cell"
        styled_rows.append([cell if not isinstance(cell, str) else p(cell, style) for cell in row])
    result = Table(styled_rows, colWidths=widths, hAlign="LEFT", repeatRows=1 if header else 0)
    commands = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, LINE),
    ]
    if header:
        commands.append(("BACKGROUND", (0, 0), (-1, 0), PURPLE))
    if zebra:
        for row_index in range(1 if header else 0, len(rows)):
            if row_index % 2 == 0:
                commands.append(("BACKGROUND", (0, row_index), (-1, row_index), SOFT))
    result.setStyle(TableStyle(commands))
    return result


def callout(text, color=TEAL):
    box = Table([[p(text, "callout")]], colWidths=[A4[0] - 2 * PAGE_MARGIN])
    box.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f7f7fa")),
                ("LINEBEFORE", (0, 0), (0, -1), 3, color),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    return KeepTogether([box, Spacer(1, 8)])


def on_page(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(PURPLE)
    canvas.rect(0, height - 5, width / 2, 5, stroke=0, fill=1)
    canvas.setFillColor(PINK)
    canvas.rect(width / 2, height - 5, width / 2, 5, stroke=0, fill=1)
    if doc.page > 1:
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(MUTED)
        canvas.drawString(PAGE_MARGIN, 10 * mm, "Arena CB Tickets · Documento de entrega")
        canvas.drawRightString(width - PAGE_MARGIN, 10 * mm, f"Página {doc.page}")
    canvas.restoreState()


def cover():
    usable = A4[0] - 2 * PAGE_MARGIN
    summary = table(
        [
            ["Item", "Situação"],
            ["Endereço do app", f'<link href="{APP_URL}" color="#8b3fe4">{APP_URL}</link>'],
            ["Estágio", "Prova de conceito (PoC) no ar, em modo teste: nenhum pagamento real é cobrado"],
            ["Pagamento", "Pix via Mercado Pago (gateway de teste ativo até a conta PJ ser configurada)"],
            ["Login", "Conta Google (sem senha própria); admins definidos por e-mail"],
            ["Custo fixo de hospedagem", "R$ 0/mês (planos gratuitos da Cloudflare)"],
        ],
        [usable * 0.32, usable * 0.68],
    )
    return [
        Spacer(1, 30 * mm),
        Image(str(LOGO), width=42 * mm, height=42 * mm),
        Spacer(1, 10 * mm),
        p("Arena CB Tickets", "title"),
        p("Venda de ingressos com Pix para os eventos da Arena CB", "subtitle"),
        Spacer(1, 3 * mm),
        p(f"Documento de entrega (handoff) · Capão Bonito/SP · {DOC_DATE}", "subtitle"),
        Spacer(1, 16 * mm),
        summary,
        PageBreak(),
    ]


def section_overview():
    return [
        p("1. O que é o Arena CB Tickets", "h1"),
        p(
            "Um site próprio, pensado primeiro para o celular, que substitui o processo manual usado hoje em cada evento "
            "(divulgar no Instagram, montar lista no Excel, enviar QR Code de Pix, conferir comprovantes e controlar a lotação). "
            "Não é preciso instalar nenhum aplicativo: o comprador abre o link do evento no navegador do celular."
        ),
        p("Como funciona, de ponta a ponta", "h2"),
        bullets(
            [
                "<b>O admin cria o evento</b> (título, data, preço, capacidade e banner) e publica. O evento ganha um link próprio.",
                "<b>O admin compartilha o link</b> no Instagram e no WhatsApp; a prévia mostra imagem, data e preço.",
                "<b>O comprador entra com a conta Google</b>, escolhe a quantidade e toca em <i>Pagar com Pix</i>.",
                "<b>O sistema gera um Pix exclusivo</b> para o pedido (QR Code e copia e cola) e reserva as vagas por 30 minutos.",
                "<b>O pagamento é confirmado automaticamente</b> com o Mercado Pago; o comprador recebe os ingressos com QR Code em <i>Meus ingressos</i>.",
                "<b>Na portaria</b>, o admin lê o QR Code do ingresso com a câmera do celular; um ingresso já usado é recusado.",
            ],
            numbered=True,
        ),
        callout(
            "<b>Sem conferência manual:</b> ninguém precisa enviar QR Code de Pix nem checar comprovante. "
            "Cada pedido tem seu próprio Pix, o sistema confirma sozinho e libera as vagas de quem não pagou."
        ),
        p("Principais recursos", "h2"),
        bullets(
            [
                "Página pública de eventos com o logo e as cores da Arena.",
                "Controle de lotação sem venda acima da capacidade, mesmo com muitas compras ao mesmo tempo.",
                "Lista de compradores pagos e download em CSV (abre no Excel).",
                "Check-in pela câmera do celular, com opção de digitar o código.",
                "Guia de primeiro acesso para o admin (criar evento, compartilhar, como funciona o QR Code de pagamento).",
                "Registro automático de atividades (logs) e verificação de segurança do código a cada atualização.",
            ]
        ),
    ]


def section_users():
    usable = A4[0] - 2 * PAGE_MARGIN
    return [
        p("2. Tipos de usuário", "h1"),
        table(
            [
                ["Perfil", "Quem é", "O que pode fazer"],
                [
                    "<b>Admin</b>",
                    "Contas Google cadastradas pela Arena (lista de e-mails definida na configuração).",
                    "Criar e publicar eventos, encerrar vendas, compartilhar o link, ver reservados, pagos e quem já entrou, "
                    "baixar a lista em CSV e fazer o check-in na portaria.",
                ],
                [
                    "<b>Comprador</b>",
                    "Qualquer pessoa com conta Google.",
                    "Ver os eventos à venda, comprar ingressos com Pix e mostrar os ingressos (QR Code) em <i>Meus ingressos</i>.",
                ],
            ],
            [usable * 0.16, usable * 0.34, usable * 0.50],
        ),
        Spacer(1, 6),
        p(
            "O login é sempre feito pelo Google: o sistema não guarda senhas. Para incluir ou remover um admin, basta alterar a lista de e-mails "
            "autorizados; a mudança vale no próximo acesso da pessoa."
        ),
    ]


def section_next_steps():
    usable = A4[0] - 2 * PAGE_MARGIN
    return [
        p("3. Próximos passos para usar em produção", "h1"),
        p(
            "Hoje o app está no ar em modo teste: o login com Google aceita só contas de teste cadastradas (até 100) e o pagamento é simulado. "
            "Para vender ingressos de verdade, faltam os passos abaixo."
        ),
        table(
            [
                ["#", "Passo", "Responsável", "Observações"],
                ["1", "Abrir (ou usar) uma conta <b>Mercado Pago PJ</b> com o CNPJ da Arena.", "Arena", "Conferir no painel a taxa do Pix e o prazo de liberação do dinheiro."],
                ["2", "Gerar as <b>credenciais de produção</b> e configurar a notificação de pagamentos (webhook).", "Arena + desenvolvedor", "As chaves são gravadas direto no servidor, nunca enviadas por e-mail ou chat."],
                ["3", "Fornecer os textos de <b>Política de Privacidade</b> e <b>Termos de Uso</b>.", "Arena", "Exigidos pelo Google para liberar o login a qualquer pessoa. Recomenda-se revisão jurídica (LGPD)."],
                ["4", "Publicar as páginas legais e enviar o app para <b>verificação do Google</b>.", "Desenvolvedor", "A verificação costuma levar alguns dias, porque a tela de login exibe o logo."],
                ["5", "Definir a lista final de <b>e-mails admin</b>.", "Arena", "Ex.: dono e gerente do bar."],
                ["6", "Desligar o modo teste e ativar o Mercado Pago (<b>PAYMENT_TEST_MODE=false</b>).", "Desenvolvedor", "Mudança de configuração; não exige alterar o código."],
                ["7", "Fazer uma <b>compra real de baixo valor</b> (ex.: evento teste de R$ 1,00) e conferir no extrato.", "Arena + desenvolvedor", "Depois, se quiser, estornar pelo painel do Mercado Pago."],
                ["8", "(Opcional) Registrar um <b>domínio próprio</b> (ex.: arenacb.com.br).", "Arena", "Ver custos opcionais na seção 5."],
            ],
            [usable * 0.05, usable * 0.42, usable * 0.17, usable * 0.36],
        ),
        Spacer(1, 6),
        callout(
            "<b>Enquanto a verificação do Google não sai:</b> dá para operar um primeiro evento cadastrando os compradores como "
            "usuários de teste (limite de 100 contas). Para vendas abertas ao público, a verificação é necessária.",
            ORANGE,
        ),
    ]


def section_first_event():
    return [
        p("4. Primeiro evento: como acompanhar as primeiras vendas", "h1"),
        p("Antes de abrir as vendas", "h2"),
        bullets(
            [
                "Entre em <b>Admin</b> e siga o guia de primeiro acesso (3 passos).",
                "Crie o evento como rascunho, confira data, preço e capacidade e toque em <b>Publicar (abrir vendas)</b>.",
                "Abra o link do evento no seu celular e faça uma compra de teste para ver a experiência do cliente.",
                "Compartilhe o link no Story (figurinha <i>Link</i>), na bio e nos grupos de WhatsApp.",
            ]
        ),
        p("Durante as vendas", "h2"),
        bullets(
            [
                "Na tela do evento, acompanhe três números: <b>reservados</b> (inclui Pix aguardando pagamento), <b>pagos</b> e <b>entraram</b>.",
                "Pix não pago em 30 minutos expira sozinho e a vaga volta para venda.",
                "A confirmação chega pelo Mercado Pago e, por segurança, o sistema reconfere os pedidos pendentes a cada 5 minutos.",
                "Compare de vez em quando os pagos do app com os recebimentos no painel do Mercado Pago.",
                "Use <b>Baixar CSV (Excel)</b> para ter a lista de compradores a qualquer momento.",
            ]
        ),
        p("No dia do evento", "h2"),
        bullets(
            [
                "Na portaria, abra o evento e toque em <b>Check-in na portaria</b> -> <b>Abrir câmera</b>.",
                "Ingresso válido mostra <i>Entrada liberada</i>; um ingresso já lido mostra <i>Ingresso já utilizado</i> com o horário.",
                "Se a câmera não funcionar (alguns iPhones), digite o código que aparece abaixo do QR Code do ingresso.",
                "Quando quiser parar de vender, toque em <b>Encerrar vendas</b>. As vendas também param sozinhas 4 horas após o início.",
            ]
        ),
        p("Dúvidas comuns", "h2"),
        bullets(
            [
                "<b>Cliente pagou e o ingresso não apareceu:</b> peça para aguardar alguns minutos na tela do pedido; a reconferência automática roda a cada 5 minutos.",
                "<b>Cliente pagou depois que o Pix expirou:</b> o pedido não é confirmado (a vaga pode já ter sido vendida) e o caso fica registrado nos logs. Faça o estorno pelo painel do Mercado Pago.",
                "<b>Cliente não consegue entrar com o Google:</b> enquanto o app não for verificado, a conta precisa estar na lista de usuários de teste.",
            ]
        ),
    ]


def section_costs():
    usable = A4[0] - 2 * PAGE_MARGIN
    return [
        p("5. Custo mensal em produção (com Mercado Pago)", "h1"),
        p(
            "A hospedagem usa os planos gratuitos da Cloudflare (servidor, banco de dados, imagens e tarefas agendadas). O custo variável é a "
            "taxa do Mercado Pago sobre cada Pix recebido, estimada em <b>~0,99%</b> (a confirmar na conta PJ). Valores com ingresso de R$ 20,00."
        ),
        table(
            [
                ["Item", "1 evento x 100 pessoas", "4 eventos x 300 pessoas"],
                ["Ingressos vendidos no mês", "100 (R$ 2.000)", "1.200 (R$ 24.000)"],
                ["Taxa Mercado Pago (~0,99%)", "R$ 19,80", "R$ 237,60"],
                ["Hospedagem Cloudflare (plano gratuito)", "R$ 0", "R$ 0"],
                ["<b>Total mensal</b>", "<b>~R$ 20</b>", "<b>~R$ 238</b>"],
                ["Comparação: taxa Sympla (10%, mínimo R$ 2,50)", "R$ 250", "R$ 3.000"],
                ["<b>Economia vs. Sympla</b>", "<b>~92%</b>", "<b>~92%</b>"],
            ],
            [usable * 0.46, usable * 0.27, usable * 0.27],
        ),
        Spacer(1, 6),
        bullets(
            [
                "Os volumes acima ficam bem abaixo dos limites gratuitos da Cloudflare (100 mil acessos por dia).",
                "Se um dia o volume passar desses limites, o plano pago da Cloudflare custa <b>US$ 5/mês (~R$ 28)</b>; mesmo assim a economia fica acima de 90%.",
                "Não há mensalidade de software nem custo por evento. A manutenção do código é feita conforme a necessidade.",
            ]
        ),
        p("Custos opcionais", "h2"),
        table(
            [
                ["Opcional", "Custo estimado", "O que envolve"],
                [
                    "<b>Domínio personalizado</b> (ex.: arenacb.com.br)",
                    "~R$ 40/ano no Registro.br (~R$ 3,33/mês)",
                    "Registro em nome do CNPJ/CPF da Arena, apontamento para a Cloudflare e atualização das configurações de login do Google. HTTPS continua gratuito.",
                ],
                [
                    "<b>Integração com Instagram</b> (publicar o evento direto do app)",
                    "R$ 0/mês de API",
                    "Exige conta Instagram Profissional (Business ou Criador) ligada a uma Página do Facebook e aprovação do app pela Meta "
                    "(estimativa de 1 a 4 semanas por envio). Hoje o app já gera o link com prévia para compartilhar manualmente.",
                ],
                [
                    "<b>IA para gerar o banner</b> do evento",
                    "R$ 0/mês no uso normal",
                    "Modelo de imagem da própria Cloudflare (Workers AI). A cota gratuita diária cobre dezenas de banners por dia; acima dela, "
                    "o custo é de frações de centavo por imagem. O admin descreve o evento e escolhe a imagem gerada.",
                ],
            ],
            [usable * 0.27, usable * 0.22, usable * 0.51],
        ),
        Spacer(1, 6),
        p(
            "Valores de referência consultados em 01/11/2026 e sujeitos a alteração pelos fornecedores. A taxa do Mercado Pago deve ser confirmada no painel da conta PJ.",
            "small",
        ),
    ]


def section_security_and_links():
    usable = A4[0] - 2 * PAGE_MARGIN
    return [
        p("6. Segurança, privacidade e operação", "h1"),
        bullets(
            [
                "Login exclusivo pelo Google; o sistema não armazena senhas.",
                "O pagamento só é confirmado depois de consultar o Mercado Pago diretamente; avisos falsos de pagamento são recusados.",
                "Coleta apenas o necessário: nome, e-mail e foto da conta Google do comprador (LGPD).",
                "Proteções contra ataques comuns da web (cabeçalhos de segurança, bloqueio de requisições de outros sites).",
                "Verificação automática de vulnerabilidades no código (CodeQL) e nas dependências a cada atualização.",
                "Registros (logs) de cada pedido, pagamento e check-in, para investigar qualquer problema.",
            ]
        ),
        p("7. Links úteis", "h1"),
        table(
            [
                ["Recurso", "Endereço"],
                ["App (página pública)", f'<link href="{APP_URL}" color="#8b3fe4">{APP_URL}</link>'],
                ["Área do admin", f'<link href="{APP_URL}/admin" color="#8b3fe4">{APP_URL}/admin</link>'],
                ["Código-fonte", f'<link href="{REPO_URL}" color="#8b3fe4">{REPO_URL}</link>'],
                ["Roteiro de teste da PoC", f'<link href="{REPO_URL}/blob/main/docs/poc-script.md" color="#8b3fe4">docs/poc-script.md</link>'],
            ],
            [usable * 0.30, usable * 0.70],
        ),
        Spacer(1, 10),
        p("Fontes dos valores", "h2"),
        p(
            "Sympla, taxa de serviço: sympla.com.br/plataforma-de-eventos-maior-do-brasil · Cloudflare Workers e Workers AI, preços: "
            "developers.cloudflare.com/workers/platform/pricing e developers.cloudflare.com/workers-ai/platform/pricing · "
            "Meta, publicação de conteúdo no Instagram: developers.facebook.com/documentation/instagram-platform/content-publishing · "
            "Domínio .com.br: Registro.br (valor anual de referência) · Mercado Pago: taxa a confirmar no painel da conta PJ.",
            "small",
        ),
    ]


def main():
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=PAGE_MARGIN,
        rightMargin=PAGE_MARGIN,
        topMargin=PAGE_MARGIN,
        bottomMargin=PAGE_MARGIN + 4 * mm,
        title="Arena CB Tickets - Documento de entrega",
        author="Fernando Ribeiro",
        subject="Handoff do app de venda de ingressos com Pix da Arena CB",
    )
    story = []
    story += cover()
    story += section_overview()
    story.append(PageBreak())
    story += section_users()
    story.append(Spacer(1, 6))
    story += section_next_steps()
    story.append(PageBreak())
    story += section_first_event()
    story.append(PageBreak())
    story += section_costs()
    story.append(PageBreak())
    story += section_security_and_links()
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print(f"written {OUTPUT}")


if __name__ == "__main__":
    main()
