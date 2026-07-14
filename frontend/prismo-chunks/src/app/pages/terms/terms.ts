import { Component, inject } from '@angular/core';
import { CommonModule }     from '@angular/common';
import { Router }           from '@angular/router';

@Component({
  selector:    'app-terms',
  standalone:  true,
  imports:     [CommonModule],
  templateUrl: './terms.html',
  styleUrls:   ['./terms.scss']
})
export class Terms {
  private readonly router = inject(Router);

  readonly sections = [
    {
      id: '01', title: 'ACEITAÇÃO',
      body: 'Ao acessar ou utilizar a plataforma Prismo, você concorda integralmente com estes Termos. Se discordar de qualquer cláusula, interrompa o uso imediatamente. O uso continuado após publicação de atualizações constitui aceite das novas versões.'
    },
    {
      id: '02', title: 'DESCRIÇÃO DO SERVIÇO',
      body: 'O Prismo é uma plataforma de composição musical modular baseada em navegador. Oferece ferramentas de criação de áudio, gerenciamento de tracks, streaming interno e integração com o ecossistema Pi Network para pagamentos e autenticação criptográfica.'
    },
    {
      id: '03', title: 'CONTA E AUTENTICAÇÃO',
      body: 'O acesso é realizado exclusivamente via Pi Network OAuth 2.0. Ao autenticar, você autoriza o Prismo a receber seu identificador Pi (uid e username) para fins de sessão segura com criptografia Diffie-Hellman (AES-256-GCM). Nenhuma senha é criada ou armazenada pelo Prismo.'
    },
    {
      id: '04', title: 'PROPRIEDADE INTELECTUAL',
      body: 'O usuário retém 100% dos direitos autorais sobre as composições criadas na plataforma. O Prismo não reivindica propriedade sobre nenhum conteúdo musical produzido. Ao utilizar a assinatura digital, o usuário registra prova criptográfica de autoria com data e hora imutável na blockchain Pi.'
    },
    {
      id: '05', title: 'PLANO DE ASSINATURA',
      body: 'O Plano Premium é cobrado mensalmente em Pi (criptomoeda nativa da Pi Network). O acesso é ativado após confirmação da transação na blockchain Stellar/Pi. Cancelamentos encerram o acesso ao término do período vigente. O Prismo não emite reembolsos em Pi após confirmação da transação on-chain.'
    },
    {
      id: '06', title: 'DISTRIBUIÇÃO DE CONTEÚDO',
      body: 'Ao solicitar distribuição para plataformas externas (Spotify, Apple Music, Deezer, etc.), o usuário concede ao Prismo licença não exclusiva para submeter o conteúdo em nome do artista. O usuário garante possuir todos os direitos necessários, incluindo samples, interpolações e colaborações. O Prismo atua como intermediário técnico e não assume responsabilidade por disputas de direitos junto às distribuidoras.'
    },
    {
      id: '07', title: 'CONTEÚDO PROIBIDO',
      body: 'É vedado publicar ou distribuir: (a) conteúdo que viole direitos de terceiros; (b) discurso de ódio ou material ilegal; (c) samples sem licença adequada; (d) conteúdo gerado por IA sem declaração explícita; (e) qualquer material que infrinja os Termos da Pi Network ou leis de direito autoral aplicáveis.'
    },
    {
      id: '08', title: 'SUSPENSÃO E ENCERRAMENTO',
      body: 'O Prismo pode suspender contas que violem estes Termos, sem aviso prévio em casos graves. Composições podem ser exportadas pelo usuário antes do encerramento definitivo. Saldos em Pi não são reembolsáveis após confirmação de transação.'
    },
    {
      id: '09', title: 'LIMITAÇÃO DE RESPONSABILIDADE',
      body: 'O Prismo não garante disponibilidade ininterrupta do serviço. Em nenhuma hipótese será responsável por perdas financeiras decorrentes de falhas de integração com Pi Network, instabilidades na rede Stellar ou indisponibilidade de plataformas de distribuição externas.'
    },
    {
      id: '10', title: 'INTEGRAÇÃO PI NETWORK & STELLAR',
      body: 'O uso do Prismo junto à Pi Network está sujeito aos Termos de Uso da Pi Network (minepi.com/terms). As transações de pagamento são executadas na rede Stellar Protocol sob a qual Pi opera. Em caso de conflito, prevalecem os termos da Pi Network para tudo que envolva transações em Pi e autenticação OAuth.'
    },
    {
      id: '11', title: 'ALTERAÇÕES',
      body: 'Estes Termos podem ser atualizados a qualquer momento. Notificações serão exibidas no dashboard antes da vigência. O uso continuado após a publicação constitui aceite das alterações.'
    }
  ];

  goBack(): void { this.router.navigate(['/']); }
}
