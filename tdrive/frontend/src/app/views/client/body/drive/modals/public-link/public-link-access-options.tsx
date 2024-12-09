import { PasswordEditorRow } from './password-editor-row';
import { ExpiryEditorRow } from './expiry-editor-row';

export const PublicLinkAccessOptions = (props: {
  disabled?: boolean;
  password?: string;
  expiration?: number;
  onChangePassword: (password: string) => Promise<void>;
  onChangeExpiration: (expiration: number) => Promise<void>;
}) => (
  <>
    <PasswordEditorRow
      disabled={props.disabled}
      password={props.password}
      onChangePassword={props.onChangePassword}
      isLinkExpired={!!props.expiration && props.expiration < Date.now()}
    />
    <ExpiryEditorRow
      disabled={props.disabled}
      value={props.expiration ?? 0}
      onChange={props.onChangeExpiration}
      isLinkPasswordProtected={!!props.password?.length}
    />
  </>
);

