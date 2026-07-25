import { Injectable, UnauthorizedException } from "@nestjs/common";
import axios from "axios";
import * as jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";

@Injectable()
export class AuthService {
  private readonly baseUrl = process.env.KEYCLOAK_BASE_URL || "http://keycloak:8080";
  private readonly publicUrl = process.env.KEYCLOAK_PUBLIC_URL || "http://localhost:8080";
  private readonly realm = process.env.KEYCLOAK_REALM || "ecosystem";
  private readonly clientId = process.env.KEYCLOAK_CLIENT_ID || "moodle-client";
  private readonly clientSecret = process.env.KEYCLOAK_CLIENT_SECRET || "moodle-secret";
  private readonly redirectUri = process.env.KEYCLOAK_REDIRECT_URI || "http://localhost:3000/auth/callback";

  private readonly jwks = jwksClient({
    jwksUri: `${this.baseUrl}/realms/${this.realm}/protocol/openid-connect/certs`,
  });

  getAuthorizationUrl(): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: "openid",
    });
    return `${this.publicUrl}/realms/${this.realm}/protocol/openid-connect/auth?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string) {
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      code,
    });

    const { data } = await axios.post(
      `${this.baseUrl}/realms/${this.realm}/protocol/openid-connect/token`,
      params.toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );

    return data;
  }

  async passwordLogin(username: string, password: string) {
    const params = new URLSearchParams({
      grant_type: "password",
      client_id: this.clientId,
      client_secret: this.clientSecret,
      username,
      password,
      scope: "openid",
    });

    const { data } = await axios.post(
      `${this.baseUrl}/realms/${this.realm}/protocol/openid-connect/token`,
      params.toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );

    return data;
  }

  decodeToken(token: string) {
    return jwt.decode(token);
  }

  async verifyToken(token: string): Promise<any> {
    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        (header, callback) => {
          this.jwks.getSigningKey(header.kid, (err, key) => {
            if (err) return callback(err);
            callback(null, key.getPublicKey());
          });
        },
        { algorithms: ["RS256"] },
        (err, decoded) => {
          if (err) {
            reject(new UnauthorizedException(`Token invalido: ${err.message}`));
          } else {
            resolve(decoded);
          }
        },
      );
    });
  }
}
