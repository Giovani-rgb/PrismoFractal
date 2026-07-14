import { Component, inject } from '@angular/core';
import { CommonModule }     from '@angular/common';
import { Router }           from '@angular/router';

@Component({
  selector:    'app-privacy',
  standalone:  true,
  imports:     [CommonModule],
  templateUrl: './privacity.html',
  styleUrls:   ['./privacity.scss']
})
export class Privacy {
  private readonly router = inject(Router);

  readonly sections = [
    {
      id: '01', title: 'DADOS COLETADOS',
      body: 'Ao autenticar via Pi Network OAuth, coletamos: identificador único Pi (uid), nome de usuário Pi (username) e, opcionalmente, endereço de e-mail fornecido voluntariamente durante o onboarding. Não coletamos senhas, documentos pessoais ou dados de pagamento diretamente — transações são processadas pela Pi Network sobre a rede Stellar.'
    },
    {
      id: '02', title: 'INTEGRAÇÃO PI NETWORK',
      body: 'A autenticação é realizada exclusivamente via Pi Network OAuth 2.0. Os dados de sessão transitam cifrados pelo protocolo Diffie-Hellman Efêmero (ECDHE) com AES-256-GCM entre cliente e servidor. O Prismo não acessa saldo Pi, transações passadas ou dados de carteira além do uid e username autorizados no escopo OAuth. Consulte: minepi.com/privacy'
    },
    {
      id: '03', title: 'FINALIDADE DO TRATAMENTO',
      body: 'Os dados coletados são usados para: (a) identificação e gerenciamento de sessão; (b) personalização do estúdio musical; (c) associação de composições e playlists à conta; (d) processamento de assinatura Premium via Pi Network; (e) envio de confirmação de cadastro por e-mail quando fornecido.'
    },
    {
      id: '04', title: 'SEGURANÇA TÉCNICA',
      body: 'Cada sessão utiliza um par de chaves Diffie-Hellman efêmero — o shared secret é gerado por sessão e descartado ao encerrar. Todos os payloads entre cliente e servidor são cifrados com AES-256-GCM. A autenticação Pi adiciona uma camada RSA-OAEP sobre o canal DH. Dados em repouso são armazenados em servidores Supabase (PostgreSQL) com criptografia em disco e TLS 1.3 em trânsito.'
    },
    {
      id: '05', title: 'REDE STELLAR & BLOCKCHAIN',
      body: 'As transações de pagamento em Pi são executadas na blockchain Stellar sob a qual a Pi Network opera. Identificadores de transação (txid) e endereços de carteira derivados do Stellar Protocol podem ser registrados para fins de auditoria e suporte ao usuário. Esses dados são públicos na blockchain e não podem ser apagados.'
    },
    {
      id: '06', title: 'COMPARTILHAMENTO COM TERCEIROS',
      body: 'O Prismo não vende, troca ou aluga dados pessoais. Dados são compartilhados apenas: (a) com plataformas de distribuição musical mediante solicitação explícita do usuário; (b) com a Pi Network para verificação de transações Stellar; (c) quando exigido por lei ou ordem judicial.'
    },
    {
      id: '07', title: 'RETENÇÃO DE DADOS',
      body: 'Sessões expiram automaticamente após 30 dias sem atividade. O usuário pode solicitar exclusão de conta e dados associados a qualquer momento. Dados de transações Pi são mantidos por 12 meses para fins de auditoria conforme políticas da Pi Network. Registros on-chain são permanentes por natureza do Stellar Protocol.'
    },
    {
      id: '08', title: 'SEUS DIREITOS',
      body: 'Você tem direito a: (a) Acesso — solicitar cópia dos dados mantidos; (b) Retificação — corrigir dados imprecisos via configurações de perfil; (c) Exclusão — encerrar conta para remoção dos dados; (d) Portabilidade — exportar composições antes de encerrar; (e) Oposição — questionar uso de seus dados via canal de suporte.'
    },
    {
      id: '09', title: 'ARMAZENAMENTO LOCAL',
      body: 'O Prismo utiliza localStorage e sessionStorage apenas para: manter sessão ativa, preferências de interface (tema, volume), e cache de refill de tempo de escuta. Nenhum cookie de rastreamento de terceiros é utilizado. Dados locais são apagados ao limpar o cache do navegador.'
    }
  ];

  goBack(): void { this.router.navigate(['/']); }
}
