import assert from 'node:assert/strict';
import test from 'node:test';
import { accountEmailText, accountMailConfig } from '../app/lib/account-email';

const env = { MAIL_HOST: 'smtp.example.com', MAIL_USERNAME: 'mailer', MAIL_PASSWORD: 'test-password', MAIL_FROM_ADDRESS: 'team@example.com', APP_URL: 'https://pharmacy.example.com', MAIL_PORT: '587' };

test('welcome email contains the new account credentials and login URL', () => {
  const message = accountEmailText({ name: 'Staff', email: 'staff@example.com', role: 'CASHIER' }, 'example-password', 'https://pharmacy.example.com/login');
  assert.match(message, /staff@example.com/);
  assert.match(message, /Password: example-password/);
  assert.match(message, /https:\/\/pharmacy.example.com\/login/);
  assert.match(message, /Cashier/);
});

test('SMTP uses TLS and the configured application URL', () => {
  const config = accountMailConfig(env);
  assert.equal(config.options.requireTLS, true);
  assert.equal(config.options.secure, false);
  assert.equal(config.loginUrl, 'https://pharmacy.example.com/login');
  assert.equal(accountMailConfig({ ...env, MAIL_PORT: '465' }).options.secure, true);
  assert.throws(() => accountMailConfig({}), /not configured/);
  assert.throws(() => accountMailConfig({ ...env, APP_URL: 'javascript:alert(1)' }), /Invalid app URL/);
});
