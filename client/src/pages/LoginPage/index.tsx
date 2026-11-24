import RequestFeedback from '../../components/ui/RequestFeedback';
import { useDelayedRequest } from '../../hooks/useDelayedRequest';
import { store } from '../../redux/store';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, Field, Input, Stack } from '@onesmall/ui';
import { useNavigate } from 'react-router-dom';
import { login } from '../../api/auth';
import AuthPageFrame from '../../components/auth/AuthPageFrame';
import styles from '../../components/auth/AuthPage.module.css';
import TextLink from '../../components/auth/TextLink';
import { toaster } from '../../components/ui/toaster';
import { useAppDispatch, useAppSelector } from '../../redux/hooks/typedHooks';
import {
  clearAuth,
  SESSION_EXPIRED_MESSAGE,
  setError,
  setLoading,
  setToken,
} from '../../redux/slices/authSlice';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const loading = useAppSelector((state) => state.auth.loading);
  // Login and register failures are shown as toasts; only session expiry is shown inline.
  const sessionExpired = useAppSelector((state) => state.auth.error === SESSION_EXPIRED_MESSAGE);

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

  const submitLogin = async () => {
    const request = begin();
    if (!request) return;
    const version = store.getState().auth.sessionVersion;
    ownerVersion.current = version;
    const current = () => request.isCurrent() && store.getState().auth.sessionVersion === version;
    dispatch(setLoading(true));
    dispatch(setError(null));
    setRequestMessage(null);
    try {
      const data = await login({ email, password }, request.signal);
      if (!current()) return;
      request.finish();
      ownerVersion.current = null;
      dispatch(clearAuth());
      localStorage.setItem('token', data.token);
      dispatch(setToken(data.token));
      toaster.create({
        title: 'Welcome back',
        description: 'You have logged in successfully.',
        type: 'success',
      });
      navigate('/home');
    } catch (error) {
      if (!current()) return;
      const message = error instanceof Error ? error.message : 'Unable to log in';
      setRequestMessage(message);
      dispatch(setError(message));
      toaster.create({ title: 'Login failed', description: message, type: 'error' });
    } finally {
      if (current()) {
        request.finish();
        ownerVersion.current = null;
        dispatch(setLoading(false));
      }
    }
  };
  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitLogin();
  };
  const cancelLogin = () => {
    cancel();
    if (
      ownerVersion.current !== null &&
      store.getState().auth.sessionVersion === ownerVersion.current
    )
      dispatch(setLoading(false));
    ownerVersion.current = null;
    setRequestMessage('Sign-in cancelled. You can try again.');
  };
  return (
    <AuthPageFrame headerAction={{ label: 'Create account', to: '/register' }}>
      <form onSubmit={handleLogin} className={styles.card}>
        <Stack gap={6}>
          <div>
            <h1 className="tf-h1 os-m-0">Welcome back</h1>
            <p className="os-text-muted os-mt-2 os-mb-0">
              Sign in to continue to your TaskForge workspace.
            </p>
          </div>
          {sessionExpired && (
            <p role="alert" className="os-text-danger os-m-0">
              {SESSION_EXPIRED_MESSAGE}
            </p>
          )}
          <Field label="Email" required>
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              size="lg"
              autoComplete="email"
            />
          </Field>
          <Field label="Password" required>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              size="lg"
              autoComplete="current-password"
            />
          </Field>
          <p className="os-text-sm os-text-end os-m-0 os-max-w-none">
            <TextLink to="/forgot-password">Forgot password?</TextLink>
          </p>
          {requestState.waiting ? (
            <RequestFeedback message="TaskForge may be waking up. Sign-in is still waiting for a response." />
          ) : requestMessage && !requestState.pending ? (
            <RequestFeedback
              message={requestMessage}
              onRetry={() => void submitLogin()}
              retryLabel="Retry sign in"
            />
          ) : null}
          {requestState.pending && (
            <Button type="button" variant="outline" onClick={cancelLogin}>
              Cancel request
            </Button>
          )}
          <Button type="submit" size="lg" fullWidth loading={loading}>
            Sign in
          </Button>
          <p className="os-text-center os-text-muted os-m-0 os-max-w-none">
            New to TaskForge? <TextLink to="/register">Create an account</TextLink>
          </p>
        </Stack>
      </form>
    </AuthPageFrame>
  );
};

export default LoginPage;
