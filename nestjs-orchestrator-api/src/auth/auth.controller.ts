import { Controller, Get, Post, Body, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { RolesGuard } from "./roles.guard";
import { Roles } from "./roles.decorator";

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  home(@Res() res: Response) {
    const loginUrl = this.authService.getAuthorizationUrl();
    res.send(`<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8" /><title>Ecosistema CETPRO KOTOSH - Login</title></head>
<body>
  <h1>Ecosistema CETPRO KOTOSH</h1>
  <p>Orquestador NestJS - Identity &amp; Integración (DEV1)</p>
  <a id="login-link" href="${loginUrl}">Iniciar sesion con Keycloak</a>
</body>
</html>`);
  }

  @Get("auth/login")
  login(@Res() res: Response) {
    return res.redirect(this.authService.getAuthorizationUrl());
  }

  @Get("auth/callback")
  async callback(@Query("code") code: string, @Res() res: Response) {
    if (!code) {
      return res.status(400).send("Falta el parametro code");
    }
    const tokenResponse = await this.authService.exchangeCodeForToken(code);
    const decoded: any = this.authService.decodeToken(tokenResponse.access_token);

    res.send(`<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8" /><title>Login exitoso</title></head>
<body>
  <h1 id="status">Login exitoso</h1>
  <p>Bienvenido, <span id="user-email">${decoded.email}</span></p>
  <p>Roles: <span id="user-roles">${(decoded.roles || []).join(", ")}</span></p>
  <pre id="jwt-payload">${JSON.stringify(decoded, null, 2)}</pre>
  <textarea id="access-token" style="display:none">${tokenResponse.access_token}</textarea>
</body>
</html>`);
  }

  @Post("auth/token")
  async token(@Body("username") username: string, @Body("password") password: string) {
    return this.authService.passwordLogin(username, password);
  }

  @Get("auth/me")
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request) {
    return req["user"];
  }

  @Get("auth/protected/teacher")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("teacher")
  teacherOnly(@Req() req: Request) {
    return { message: "Acceso concedido a recurso de docentes", user: req["user"] };
  }
}
