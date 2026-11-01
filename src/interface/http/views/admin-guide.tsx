import type { Child } from "hono/jsx";

export const GUIDE_STEP_COUNT = 3;

export interface AdminGuideProps {
  readonly step: number;
  readonly orderTtlMinutes: number;
  readonly testMode: boolean;
}

interface GuideStep {
  readonly title: string;
  readonly content: (props: AdminGuideProps) => Child;
}

const CREATE_EVENT_STEP: GuideStep = { title: "Criar um evento", content: CreateEventStep };

const STEPS: ReadonlyArray<GuideStep> = [
  CREATE_EVENT_STEP,
  { title: "Compartilhar o evento", content: ShareEventStep },
  { title: "QR Code de pagamento (Pix)", content: PixPaymentStep },
];

/** First-access onboarding for admins: one step per screen, navigation by links (works without JavaScript). */
export function AdminGuide(props: AdminGuideProps) {

  const current: GuideStep = STEPS[props.step - 1] ?? CREATE_EVENT_STEP;

  return (
    <section class="guide">
      <p class="muted">Guia rápido do administrador · passo {props.step} de {GUIDE_STEP_COUNT}</p>
      <StepDots step={props.step} />
      <h1 class="gradient-text">{current.title}</h1>
      {current.content(props)}
      <GuideNavigation step={props.step} />
    </section>
  );
}


function StepDots(props: { readonly step: number }) {

  const steps: ReadonlyArray<number> = Array.from({ length: GUIDE_STEP_COUNT }, (_, index) => index + 1);

  return (
    <ol class="guide-dots" aria-label="Progresso do guia">
      {steps.map((step) => (
        <li class={step <= props.step ? "active" : ""} aria-current={step === props.step ? "step" : undefined}>
          {step}
        </li>
      ))}
    </ol>
  );
}

function CreateEventStep() {
  return (
    <>
      <div class="card">
        <p>
          <strong>Onde:</strong> no topo da tela, toque em <strong>Admin</strong> e depois no botão:
        </p>
        <div class="guide-preview">
          <span class="btn">+ Novo evento</span>
        </div>
      </div>
      <div class="card">
        <p>
          <strong>Preencha:</strong>
        </p>
        <ul class="guide-list">
          <li>Título, descrição e data/hora (horário de Brasília).</li>
          <li>Preço do ingresso (ex.: 20,00) e capacidade de pessoas.</li>
          <li>Banner opcional (JPG/PNG/WebP): ele aparece na prévia do link no Instagram e no WhatsApp.</li>
        </ul>
      </div>
      <div class="card">
        <p>
          Ao tocar em <strong>Criar rascunho</strong>, o evento ainda fica escondido do público. Confira os dados e toque em:
        </p>
        <div class="guide-preview">
          <span class="btn">Publicar (abrir vendas)</span>
        </div>
        <p class="muted">A partir daí ele aparece na página inicial e já aceita compras.</p>
      </div>
    </>
  );
}

function ShareEventStep() {
  return (
    <>
      <div class="card">
        <p>
          <strong>Onde:</strong> abra o evento em <strong>Admin</strong> e toque em:
        </p>
        <div class="guide-preview">
          <span class="btn secondary">Compartilhar no Instagram/WhatsApp</span>
        </div>
        <p class="muted">No celular abre o menu de compartilhar; no computador o link é copiado.</p>
      </div>
      <div class="card">
        <ul class="guide-list">
          <li>
            <strong>WhatsApp:</strong> cole o link na conversa ou no grupo; a mensagem mostra imagem, título, data e preço.
          </li>
          <li>
            <strong>Instagram:</strong> no Story use a figurinha <strong>Link</strong>, ou coloque o link na bio.
          </li>
          <li>
            O link público também aparece na tela do evento, para copiar quando quiser.
          </li>
        </ul>
      </div>
      <div class="alert ok">Dica: um banner horizontal (16:9) deixa a prévia do link mais bonita.</div>
    </>
  );
}

function PixPaymentStep(props: AdminGuideProps) {
  return (
    <>
      <div class="card">
        <p>
          <strong>Você não precisa mandar QR Code nem conferir comprovante.</strong> O sistema gera um Pix exclusivo para cada pedido e
          confirma o pagamento sozinho.
        </p>
      </div>
      <div class="card">
        <p>
          <strong>O que o comprador vê:</strong>
        </p>
        <ol class="guide-list">
          <li>Abre o link do evento e entra com a conta Google.</li>
          <li>Escolhe a quantidade e toca em <strong>Pagar com Pix</strong>.</li>
          <li>
            Aparece o <strong>QR Code Pix</strong> e o código <strong>copia e cola</strong>, válidos por {props.orderTtlMinutes} minutos.
          </li>
          <li>Paga no app do banco; a tela confirma em segundos e os ingressos (com QR Code) ficam em Meus ingressos.</li>
        </ol>
        <p class="muted">As vagas ficam reservadas enquanto o Pix está pendente e voltam para venda se ele não for pago.</p>
      </div>
      <div class="card">
        <p>
          <strong>Acompanhe e controle a entrada:</strong> na tela do evento você vê reservados, pagos e a lista de compradores (com
          download em CSV para Excel). Na porta, use <strong>Check-in na portaria</strong> para ler o QR Code do ingresso com a câmera.
        </p>
      </div>
      {props.testMode && (
        <div class="alert test">Modo teste: no lugar do pagamento real, use o botão "Simular pagamento (teste)" na tela do Pix.</div>
      )}
    </>
  );
}

function GuideNavigation(props: { readonly step: number }) {

  const isLast: boolean = props.step >= GUIDE_STEP_COUNT;

  return (
    <div class="guide-nav">
      {isLast ? (
        <form method="post" action="/admin/guide/complete">
          <button class="btn" type="submit">Entendi, criar meu primeiro evento</button>
        </form>
      ) : (
        <a class="btn" href={`/admin/guide?step=${props.step + 1}`}>
          Próximo
        </a>
      )}
      <div class="row">
        {props.step > 1 && (
          <a class="btn secondary" href={`/admin/guide?step=${props.step - 1}`}>
            Voltar
          </a>
        )}
        {!isLast && (
          <form method="post" action="/admin/guide/complete">
            <input type="hidden" name="next" value="dashboard" />
            <button class="btn secondary" type="submit">Pular guia</button>
          </form>
        )}
      </div>
    </div>
  );
}
