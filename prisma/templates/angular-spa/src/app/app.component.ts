import { Component } from "@angular/core";

@Component({
  selector: "app-root",
  template: `
    <div class="shell">
      <div class="card">
        <span class="badge">@okta/okta-angular</span>
        <h1>Okta Angular SDK</h1>
        <router-outlet></router-outlet>
      </div>
    </div>
  `,
})
export class AppComponent {}
