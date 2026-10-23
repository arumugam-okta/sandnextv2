import { NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";
import { RouterModule, Routes } from "@angular/router";
import { OKTA_CONFIG, OktaAuthModule, OktaCallbackComponent } from "@okta/okta-angular";
import { OktaAuth } from "@okta/okta-auth-js";
import { AppComponent } from "./app.component";
import { HomeComponent } from "./home.component";
import { env } from "./env";

const oktaAuth = new OktaAuth({
  issuer: env.issuer,
  clientId: env.clientId,
  redirectUri: window.location.origin + "/login/callback",
  scopes: ["openid", "profile", "email"],
  pkce: true,
});

const routes: Routes = [
  { path: "", component: HomeComponent },
  { path: "login/callback", component: OktaCallbackComponent },
];

@NgModule({
  declarations: [AppComponent, HomeComponent],
  imports: [BrowserModule, RouterModule.forRoot(routes), OktaAuthModule],
  providers: [{ provide: OKTA_CONFIG, useValue: { oktaAuth } }],
  bootstrap: [AppComponent],
})
export class AppModule {}
