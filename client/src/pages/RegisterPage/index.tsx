import RequestFeedback from '../../components/ui/RequestFeedback';
import { useDelayedRequest } from '../../hooks/useDelayedRequest';
import { UNCERTAIN_CHANGE_MESSAGE } from '../../api/request';
import { store } from '../../redux/store';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, Field, Input, Stack } from '@onesmall/ui';
import { useNavigate } from 'react-router-dom';
import { register } from '../../api/auth';
import AuthPageFrame from '../../components/auth/AuthPageFrame';
import styles from '../../components/auth/AuthPage.module.css';
import TextLink from '../../components/auth/TextLink';
import { getRegistrationPasswordError, REGISTRATION_PASSWORD_HELP } from '../../utils/authInput';
import { toaster } from '../../components/ui/toaster';
import { useAppDispatch, useAppSelector } from '../../redux/hooks/typedHooks';
import { setError, setLoading } from '../../redux/slices/authSlice';

const RegisterPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const loading = useAppSelector((state) => state.auth.loading);

  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const requestState = useDelayedRequest();
  const { begin, cancel } = requestState;
  const ownerVersion = useRef<number | null>(null);
  const sessionVersion = useAppSelector((state) => state.auth.sessionVersion);
  useEffect(
    () => () => {
      cancel();
      if (
        ownerVersion.current !== null &&
        store.getState().auth.sessionVersion === ownerVersion.current
      )
        dispatch(setLoading(false));
      ownerVersion.current = null;
    },
    [cancel, dispatch, sessionVersion],
  );

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (requestState.pending) return;
    const validationError = getRegistrationPasswordError(password);
    setPasswordError(validationError);
    if (validationError) {
      passwordInput.current?.focus();
      return;
    }
    const request = begin();
    if (!request) return;
    const version = store.getState().auth.sessionVersion;
    ownerVersion.current = version;
    const current = () => request.isCurrent() && store.getState().auth.sessionVersion === version;
    dispatch(setLoading(true));
    dispatch(setError(null));
    setRequestMessage(null);
    try {
      await register({ email, password }, request.signal);
      if (!current()) return;
      request.finish();
      ownerVersion.current = null;
      dispatch(setLoading(false));
      toaster.create({
        title: 'Account created',
        description: 'Your workspace is ready. Sign in to continue.',
        type: 'success',
      });
      navigate('/login');
    } catch (error) {
      if (!current()) return;
      const message = error instanceof Error ? error.message : 'Unable to register';
      setRequestMessage(message);
      dispatch(setError(message));
      toaster.create({ title: 'Registration failed', description: message, type: 'error' });
    } finally {
      if (current()) {
        request.finish();
        ownerVersion.current = null;
        dispatch(setLoading(false));
      }
    }
  };
  const cancelRegistration = () => {
    cancel();
    if (
      ownerVersion.current !== null &&
      store.getState().auth.sessionVersion === ownerVersion.current
    )
      dispatch(setLoading(false));
    ownerVersion.current = null;
    setRequestMessage(UNCERTAIN_CHANGE_MESSAGE);
  };
  return (
    <AuthPageFrame>
      <form onSubmit={handleRegister} className={styles.card}>
        <Stack gap={6}>
          <div>
            <h1 className="tf-h1 os-m-0">Create your workspace</h1>
            <p className="os-text-muted os-mt-2 os-mb-0">
              Start organizing tasks, priorities, due dates, and progress.
            </p>
          </div>
          <Field label="Email" required>
            <Input
              type="email"
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              size="lg"
              autoComplete="email"
            />
          </Field>
          <Field
            label="Password"
            required
            hint={REGISTRATION_PASSWORD_HELP}
            error={passwordError ?? undefined}
          >
            <Input
              ref={passwordInput}
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setPasswordError(null);
              }}
              placeholder="Create a password"
              size="lg"
              autoComplete="new-password"
            />
          </Field>
          {requestState.waiting ? (
            <RequestFeedback message="TaskForge may be waking up. Account creation is still waiting for a response." />
          ) : requestMessage && !requestState.pending ? (
            <RequestFeedback message={requestMessage} />
          ) : null}
          {requestState.pending && (
            <Button type="button" variant="outline" onClick={cancelRegistration}>
              Cancel request
            </Button>
          )}
          <Button type="submit" size="lg" fullWidth loading={loading}>
            Create account
          </Button>
          <p className="os-text-center os-text-muted os-m-0 os-max-w-none">
            Already have an account? <TextLink to="/login">Sign in</TextLink>
          </p>
        </Stack>
      </form>
    </AuthPageFrame>
  );
};

export default RegisterPage;
