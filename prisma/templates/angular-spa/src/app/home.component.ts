import { Component, Inject, OnInit } from "@angular/core";
import { OKTA_AUTH, OktaAuthStateService } from "@okta/okta-angular";
import { OktaAuth, UserClaims } from "@okta/okta-auth-js";

@Component({
  selector: "app-home",
  template: `
    <ng-container *ngIf="authState.authState$ | async as state; else loading">
      <div class="error" *ngIf="state.error">{{ state.error }}</div>
      <ng-container *ngIf="!state.error">
        <ng-container *ngIf="!state.isAuthenticated">
          <p class="muted">You are signed out. Sign in to see the ID token claims.</p>
          <button class="btn" (click)="signIn()">Sign in with Okta</button>
        </ng-container>
        <ng-container *ngIf="state.isAuthenticated">
          <div class="row">
            <span class="status">Signed in{{ user?.email ? " as " + user.email : "" }}</span>
            <button class="btn secondary" (click)="signOut()">Sign out</button>
          </div>
          <pre>{{ user | json }}</pre>
        </ng-container>
      </ng-container>
    </ng-container>
    <ng-template #loading><p class="muted">Loading…</p></ng-template>
  `,
})
export class HomeComponent implements OnInit {
  user: UserClaims | null = null;

  constructor(
    @Inject(OKTA_AUTH) private oktaAuth: OktaAuth,
    public authState: OktaAuthStateService
  ) {}

  ngOnInit() {
    this.authState.authState$.subscribe((s) => {
      if (s.isAuthenticated) this.oktaAuth.getUser().then((u) => (this.user = u));
    });
  }

  signIn() {
    return this.oktaAuth.signInWithRedirect();
  }

  signOut() {
    return this.oktaAuth.signOut();
  }
}
