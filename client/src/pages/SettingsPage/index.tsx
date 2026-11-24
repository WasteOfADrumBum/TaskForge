import { Button, Stack } from '@onesmall/ui';
import { useColorMode } from '../../components/ui/color-mode';
import { LuLaptop, LuMoon, LuSun } from 'react-icons/lu';

const SettingsPage = () => {
  const { preference: theme, setColorMode: setTheme } = useColorMode();
  return (
    <div>
      <h1 className="tf-h1 os-m-0">Settings</h1>
      <p className="os-text-muted os-mt-2 os-mb-8">Manage your TaskForge workspace preferences.</p>
      <Stack gap={6} style={{ maxWidth: '48rem' }}>
        <div className="tf-panel os-p-6">
          <h2 className="tf-h2 os-m-0">Appearance</h2>
          <p className="os-text-muted os-mt-1 os-mb-5">
            Choose how TaskForge looks on this device.
          </p>
          <div
            className="os-flex os-flex-wrap os-items-center os-gap-3"
            role="group"
            aria-label="Color theme"
          >
            <Button
              variant={theme === 'system' ? 'solid' : 'outline'}
              aria-pressed={theme === 'system'}
              onClick={() => setTheme('system')}
              leftIcon={<LuLaptop aria-hidden="true" focusable="false" />}
            >
              System
            </Button>
            <Button
              variant={theme === 'light' ? 'solid' : 'outline'}
              aria-pressed={theme === 'light'}
              onClick={() => setTheme('light')}
              leftIcon={<LuSun aria-hidden="true" focusable="false" />}
            >
              Light
            </Button>
            <Button
              variant={theme === 'dark' ? 'solid' : 'outline'}
              aria-pressed={theme === 'dark'}
              onClick={() => setTheme('dark')}
              leftIcon={<LuMoon aria-hidden="true" focusable="false" />}
            >
              Dark
            </Button>
          </div>
        </div>
        <div className="tf-panel os-p-6">
          <h2 className="tf-h2 os-m-0">Account</h2>
          <p className="os-text-muted os-mt-2 os-mb-0">
            Profile details and account-management controls are planned and are not available yet.
          </p>
        </div>
        <div className="tf-panel os-p-6">
          <h2 className="tf-h2 os-m-0">Danger Zone</h2>
          <p className="os-text-muted os-mt-2 os-mb-0">
            Account deletion is planned and is not available yet.
          </p>
        </div>
      </Stack>
    </div>
  );
};
export default SettingsPage;
