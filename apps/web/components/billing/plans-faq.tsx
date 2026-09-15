import {
  AI_OVERAGE_NOTE,
  ANNUAL_BOLETO_NOTE,
  GRACE_DAYS,
  PLAN_KEYS,
  PLANS,
  STORAGE_FAIR_USE_NOTE,
  TRIAL_AI_CONVERSATIONS,
  TRIAL_BASE_PLAN,
  TRIAL_DAYS,
} from "@workspace/core/billing"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion"

const SMALLEST_PLAN = PLANS[PLAN_KEYS[0] ?? "corretor"]
const LARGEST_PLAN = PLANS[PLAN_KEYS[PLAN_KEYS.length - 1] ?? "rede"]

const QUESTIONS: ReadonlyArray<{ id: string; question: string; answer: string[] }> = [
  {
    id: "teste",
    question: "O teste grátis pede cartão?",
    answer: [
      `Não. São ${TRIAL_DAYS} dias com os recursos do plano ${PLANS[TRIAL_BASE_PLAN].name} (com ${TRIAL_AI_CONVERSATIONS} conversas de IA), sem cartão e sem compromisso. Você escolhe o plano só se quiser continuar.`,
    ],
  },
  {
    id: "pagamento",
    question: "Quais são as formas de pagamento?",
    answer: [
      "Cartão de crédito, com cobrança recorrente, e boleto bancário.",
      `${ANNUAL_BOLETO_NOTE}.`,
      "Pix e parcelamento ainda não estão disponíveis. O plano anual é pago à vista, com 2 meses grátis.",
    ],
  },
  {
    id: "nota-fiscal",
    question: "Vocês emitem nota fiscal?",
    answer: [
      "A emissão automática da nota fiscal está em implantação. No pagamento, você já informa o CPF ou CNPJ que vai na nota.",
    ],
  },
  {
    id: "fim-do-teste",
    question: "O que acontece quando o teste termina?",
    answer: [
      `Se você ainda não assinou, a conta segue com acesso completo por mais ${GRACE_DAYS} dias. Depois, entra em modo leitura: você continua vendo e exportando tudo, mas não cria nem edita.`,
      "Nada é apagado, e as suas landing pages continuam captando leads. Ao assinar, tudo volta a funcionar na hora.",
    ],
  },
  {
    id: "conversa-ia",
    question: "O que é uma conversa de IA?",
    answer: [
      "É um lead atendido pelo agente de IA no WhatsApp dentro de 24 horas, com até 40 mensagens. Se o mesmo lead volta no dia seguinte, conta como outra conversa.",
      "O agente está chegando. Quando a franquia do mês acaba, o lead passa para um corretor e nunca fica sem resposta.",
      `${AI_OVERAGE_NOTE}.`,
    ],
  },
  {
    id: "armazenamento",
    question: "Quanto espaço tenho para fotos e documentos?",
    answer: [
      `De ${SMALLEST_PLAN.limits.storage_gb} GB no ${SMALLEST_PLAN.name} a ${LARGEST_PLAN.limits.storage_gb} GB no ${LARGEST_PLAN.name}, sem limite de imóveis.`,
      `${STORAGE_FAIR_USE_NOTE}.`,
    ],
  },
  {
    id: "troca",
    question: "Posso trocar de plano depois?",
    answer: [
      "Pode. O upgrade vale na hora, com cobrança proporcional. O downgrade vale no próximo ciclo e nada do que você cadastrou é apagado.",
    ],
  },
  {
    id: "cancelamento",
    question: "Como faço para cancelar?",
    answer: [
      "Direto no app, na tela de assinatura, sem multa. O acesso continua até o fim do período pago, e a exportação completa fica disponível por 90 dias.",
    ],
  },
]

export function PlansFaq() {
  return (
    <Accordion>
      {QUESTIONS.map((item) => (
        <AccordionItem key={item.id} value={item.id}>
          <AccordionTrigger>{item.question}</AccordionTrigger>
          <AccordionContent className="text-muted-foreground">
            {item.answer.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
