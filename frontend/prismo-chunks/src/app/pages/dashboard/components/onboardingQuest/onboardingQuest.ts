import { Component, Input, Output, EventEmitter, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-arcade-onboarding-quests',
  imports: [CommonModule],
  templateUrl: './onboardingQuest.html',
  styleUrls: ['./onboardingQuest.scss']
})
export class OnboardingQuests {
  private cdr = inject(ChangeDetectorRef);

  @Input() quests: any = {
    accountActivated: false,
    emailProvided: false,
    profileConfigured: false,
    donationMade: false
  };

  @Output() onTriggerAction = new EventEmitter<string>();
  @Output() onEmailSubmitted = new EventEmitter<string>();

  showEmailForm:  boolean = false;
  emailValue:     string  = '';
  emailError:     string  = '';
  emailSubmitted: boolean = false;

  executeQuestAction(questKey: string) {
    if (questKey === 'email') {
      if (this.quests?.emailProvided || this.emailSubmitted) return;
      this.showEmailForm = !this.showEmailForm;
      this.emailError = '';
      return;
    }
    this.onTriggerAction.emit(questKey);
  }

  onEmailInput(event: Event) {
    this.emailValue = (event.target as HTMLInputElement).value;
    this.emailError = '';
  }

  submitEmail() {
    const email = this.emailValue.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email) {
      this.emailError = 'CAMPO OBRIGATÓRIO';
      return;
    }
    if (!emailPattern.test(email)) {
      this.emailError = 'FORMATO INVÁLIDO';
      return;
    }

    localStorage.setItem('prismo_user_email', email);
    this.emailSubmitted = true;
    this.showEmailForm  = false;
    this.emailError     = '';

    this.onEmailSubmitted.emit(email);
    this.onTriggerAction.emit('email');
    this.cdr.detectChanges();
  }

  cancelEmailForm() {
    this.showEmailForm = false;
    this.emailValue    = '';
    this.emailError    = '';
  }

  get isEmailDone(): boolean {
    return this.quests?.emailProvided || this.emailSubmitted;
  }
}
