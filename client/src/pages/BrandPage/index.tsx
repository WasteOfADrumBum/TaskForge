import {
  Box,
  Button,
  chakra,
  Field,
  Heading,
  HStack,
  Image,
  Input,
  Link,
  NativeSelect,
  Text,
  Textarea,
  VStack,
} from '@chakra-ui/react';
import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { LuDownload, LuExternalLink, LuPlus, LuSave } from 'react-icons/lu';
import { isCurrentSession } from '../../api/authenticatedFetch';
import { getBrands, saveBrand } from '../../api/brands';
import { useDelayedRequest } from '../../hooks/useDelayedRequest';
import { useAppSelector } from '../../redux/hooks/typedHooks';
import {
  BRAND_COLOR_NAME_MAX,
  BRAND_COLORS_MAX,
  BRAND_FONT_FAMILY_MAX,
  BRAND_FONT_ROLES,
  BRAND_FONTS_MAX,
  BRAND_KINDS,
  BRAND_LOGO_LABEL_MAX,
  BRAND_LOGO_URL_MAX,
  BRAND_LOGOS_MAX,
  BRAND_NAME_MAX,
  BRAND_PROMPT_MAX,
  BRAND_PROMPTS_MAX,
  BRAND_TAGLINE_MAX,
  BRAND_TEXT_MAX,
  brandFontRoleLabel,
  brandKindLabel,
  type BrandFontRole,
  type BrandInput,
  type BrandKind,
  type BrandProfile,
} from '../../types/brand';
import {
  brandGuideFileName,
  brandGuideMarkdown,
  brandInputOf,
  contrastCheck,
  contrastText,
  isSitePath,
  normalizeBrandInput,
  normalizeHex,
  safeLogoHref,
} from '../../utils/brand';
import { SessionExpiredError } from '../../utils/session';

const panel = {
  bg: 'bg.panel',
  borderWidth: '1px',
  borderRadius: 'lg',
  p: { base: 4, md: 5 },
} as const;
const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

// Repeated rows carry a stable key so React keeps focus and input state on the right row.
type Keyed<T> = T & { key: number };
interface Draft {
  name: string;
  tagline: string;
  colors: Keyed<{ name: string; hex: string }>[];
  fonts: Keyed<{ role: BrandFontRole; family: string }>[];
  logos: Keyed<{ label: string; url: string }>[];
  voice: string;
  writingStyle: string;
  imagePrompts: Keyed<{ text: string }>[];
}
type ListKey = 'colors' | 'fonts' | 'logos' | 'imagePrompts';

let nextKey = 1;
const keyed = <T extends object>(item: T): Keyed<T> => ({ ...item, key: nextKey++ });
const toDraft = (input: BrandInput): Draft => ({
  name: input.name,
  tagline: input.tagline,
  colors: input.colors.map(keyed),
  fonts: input.fonts.map(keyed),
  logos: input.logos.map(keyed),
  voice: input.voice,
  writingStyle: input.writingStyle,
  imagePrompts: input.imagePrompts.map((text) => keyed({ text })),
});
const toInput = (draft: Draft): BrandInput => ({
  name: draft.name,
  tagline: draft.tagline,
  colors: draft.colors.map(({ name, hex }) => ({ name, hex })),
  fonts: draft.fonts.map(({ role, family }) => ({ role, family })),
  logos: draft.logos.map(({ label, url }) => ({ label, url })),
  voice: draft.voice,
  writingStyle: draft.writingStyle,
  imagePrompts: draft.imagePrompts.map(({ text }) => text),
});
const sameInput = (a: BrandInput, b: BrandInput) =>
  JSON.stringify(normalizeBrandInput(a)) === JSON.stringify(normalizeBrandInput(b));

// Saves the guide through a temporary link; nothing leaves the browser.
const downloadText = (fileName: string, text: string) => {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked after the click has been handled, so no browser cancels the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const ListSection = ({
  id,
  title,
  hint,
  count,
  max,
  addLabel,
  onAdd,
  addRef,
  children,
}: {
  id: string;
  title: string;
  hint: string;
  count: number;
  max: number;
  addLabel: string;
  onAdd: () => void;
  addRef: RefObject<HTMLButtonElement | null>;
  children: React.ReactNode;
}) => (
  <Box as="fieldset" borderWidth="1px" borderColor="border.muted" borderRadius="md" p={3}>
    <Text as="legend" fontWeight="semibold" px={1} id={id}>
      {title}
    </Text>
    <Text fontSize="sm" color="fg.muted" mb={2}>
      {hint}
    </Text>
    {count > 0 && (
      <Box as="ul" role="list" listStyleType="none" m={0} p={0}>
        {children}
      </Box>
    )}
    {count < max ? (
      <Button size="xs" variant="outline" mt={2} onClick={onAdd} ref={addRef}>
        <LuPlus aria-hidden="true" focusable="false" />
        {addLabel}
      </Button>
    ) : (
      <Text fontSize="sm" color="fg.muted" mt={2}>
        That is the most this profile can hold.
      </Text>
    )}
  </Box>
);

const rowStyle = {
  as: 'li',
  py: 3,
  borderTopWidth: '1px',
  borderColor: 'border.muted',
} as const;

const BrandPage = () => {
  const token = useAppSelector((state) => state.auth.token);
  const sessionVersion = useAppSelector((state) => state.auth.sessionVersion);
  const sessionKey = token + ':' + sessionVersion;
  // Saved profiles and drafts belong to the session they were loaded in, so a new sign-in
  // never shows the last user's brands.
  const [data, setData] = useState<{
    key: string;
    saved: Partial<Record<BrandKind, BrandProfile>>;
    drafts: Record<BrandKind, Draft>;
  } | null>(null);
  const loaded = data?.key === sessionKey;
  const [kind, setKind] = useState<BrandKind>('taskforge');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // The field a client-side check flagged, marked invalid until the next edit.
  const [invalidField, setInvalidField] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<{ key: string; at: Partial<Record<BrandKind, string>> }>({
    key: '',
    at: {},
  });
  const [reloadKey, setReloadKey] = useState(0);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const addColorRef = useRef<HTMLButtonElement>(null);
  const addFontRef = useRef<HTMLButtonElement>(null);
  const addLogoRef = useRef<HTMLButtonElement>(null);
  const addPromptRef = useRef<HTMLButtonElement>(null);
  const read = useDelayedRequest();
  const write = useDelayedRequest();
  const { begin } = read;

  useEffect(() => {
    if (!token || !isCurrentSession(token, sessionVersion)) return;
    const request = begin();
    if (!request) return;
    void getBrands(token, request.signal)
      .then((brands) => {
        if (!request.isCurrent() || !isCurrentSession(token, sessionVersion)) return;
        const saved: Partial<Record<BrandKind, BrandProfile>> = {};
        for (const brand of brands) if (BRAND_KINDS.includes(brand.kind)) saved[brand.kind] = brand;
        // Drafts are built once per load, so their row keys stay stable across renders.
        const drafts = {
          taskforge: toDraft(brandInputOf(saved.taskforge)),
          personal: toDraft(brandInputOf(saved.personal)),
        };
        setData({ key: token + ':' + sessionVersion, saved, drafts });
        setLoadError(null);
      })
      .catch((failure: unknown) => {
        if (
          !request.isCurrent() ||
          !isCurrentSession(token, sessionVersion) ||
          failure instanceof SessionExpiredError
        )
          return;
        setLoadError(failure instanceof Error ? failure.message : 'Unable to load your brands');
      })
      .finally(request.finish);
    return request.cancel;
  }, [token, sessionVersion, reloadKey, begin]);

  const saved = loaded ? data.saved[kind] : undefined;
  const draft = loaded ? data.drafts[kind] : null;
  const update = (change: (current: Draft) => Draft) => {
    setSaveError(null);
    setInvalidField(null);
    setData((current) => {
      if (!current || current.key !== sessionKey) return current;
      return { ...current, drafts: { ...current.drafts, [kind]: change(current.drafts[kind]) } };
    });
  };
  const setField = <K extends keyof Draft>(field: K, value: Draft[K]) =>
    update((current) => ({ ...current, [field]: value }));
  const setRow = <K extends ListKey>(list: K, key: number, change: Partial<Draft[K][number]>) =>
    update((current) => ({
      ...current,
      [list]: (current[list] as Array<Keyed<object>>).map((row) =>
        row.key === key ? { ...row, ...change } : row,
      ),
    }));
  const addRow = <K extends ListKey>(list: K, row: Omit<Draft[K][number], 'key'>) =>
    update((current) => ({ ...current, [list]: [...current[list], keyed(row as object)] }));
  // The removed row's button is gone, so focus moves to that list's add button.
  const removeRow = (list: ListKey, key: number) => {
    update((current) => ({
      ...current,
      [list]: (current[list] as Array<Keyed<object>>).filter((row) => row.key !== key),
    }));
    const addRef =
      list === 'colors'
        ? addColorRef
        : list === 'fonts'
          ? addFontRef
          : list === 'logos'
            ? addLogoRef
            : addPromptRef;
    requestAnimationFrame(() => addRef.current?.focus());
  };

  // The first problem a save would hit, with the field to focus, so the error names its row.
  const findProblem = (current: Draft): { message: string; field: string } | null => {
    if (!current.name.trim()) return { message: 'Give the brand a name.', field: 'brand-name' };
    const colorNames = new Set<string>();
    for (const [index, color] of current.colors.entries()) {
      const n = index + 1;
      const name = color.name.trim().toLowerCase();
      if (!name)
        return { message: 'Color ' + n + ' needs a name.', field: 'color-name-' + color.key };
      if (colorNames.has(name))
        return {
          message: 'Color ' + n + ' repeats a color name.',
          field: 'color-name-' + color.key,
        };
      colorNames.add(name);
      if (!normalizeHex(color.hex))
        return {
          message: 'Color ' + n + ' needs a six-digit hex code, for example #0F766E.',
          field: 'color-hex-' + color.key,
        };
    }
    const roles = new Set<BrandFontRole>();
    for (const [index, font] of current.fonts.entries()) {
      const n = index + 1;
      if (roles.has(font.role))
        return {
          message: 'Font ' + n + ' repeats a role. Use each role once.',
          field: 'font-role-' + font.key,
        };
      roles.add(font.role);
      if (!font.family.trim())
        return { message: 'Font ' + n + ' needs a family.', field: 'font-family-' + font.key };
    }
    for (const [index, logo] of current.logos.entries()) {
      const n = index + 1;
      if (!logo.label.trim())
        return { message: 'Logo ' + n + ' needs a label.', field: 'logo-label-' + logo.key };
      if (!safeLogoHref(logo.url.trim()))
        return {
          message: 'Logo ' + n + ' needs a full https link or a path that starts with /.',
          field: 'logo-url-' + logo.key,
        };
    }
    for (const [index, prompt] of current.imagePrompts.entries()) {
      if (!prompt.text.trim())
        return {
          message: 'Image prompt ' + (index + 1) + ' is empty. Fill it in or remove it.',
          field: 'prompt-' + prompt.key,
        };
    }
    return null;
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft || !token || !isCurrentSession(token, sessionVersion)) return;
    const problem = findProblem(draft);
    if (problem) {
      setSaveError(problem.message);
      setInvalidField(problem.field);
      // Each checked field carries data-field, so the failed one can take focus.
      event.currentTarget
        .querySelector<HTMLElement>('[data-field="' + problem.field + '"]')
        ?.focus();
      return;
    }
    const request = write.begin();
    if (!request) return;
    setSaveError(null);
    const savingKind = kind;
    const savingKey = sessionKey;
    void saveBrand(token, savingKind, toInput(draft), request.signal)
      .then((brand) => {
        if (!request.isCurrent() || !isCurrentSession(token, sessionVersion)) return;
        // Keep what is on screen: edits made while saving must not be overwritten.
        setData((current) =>
          current && current.key === savingKey
            ? { ...current, saved: { ...current.saved, [savingKind]: brand } }
            : current,
        );
        setSavedAt((current) => ({
          key: savingKey,
          at: {
            ...(current.key === savingKey ? current.at : {}),
            [savingKind]: brand.updatedAt ?? new Date().toISOString(),
          },
        }));
      })
      .catch((failure: unknown) => {
        if (
          !request.isCurrent() ||
          !isCurrentSession(token, sessionVersion) ||
          failure instanceof SessionExpiredError
        )
          return;
        setSaveError(failure instanceof Error ? failure.message : 'Unable to save your brand');
      })
      .finally(request.finish);
  };

  const dirty = !!draft && !sameInput(toInput(draft), brandInputOf(saved));
  const savedLogoUrls = new Set(saved?.logos.map((logo) => logo.url));
  const lastSaved = (savedAt.key === sessionKey ? savedAt.at[kind] : undefined) ?? saved?.updatedAt;
  // Errors are announced by their alerts, so the status line stays quiet then.
  let status = '';
  if (read.pending)
    status = read.waiting ? 'Still loading your brands...' : 'Loading your brands...';
  else if (write.pending) status = write.waiting ? 'Still saving...' : 'Saving your brand...';
  else if (loadError || saveError) status = '';
  else if (loaded && dirty) status = 'Unsaved changes.';
  else if (loaded && saved && lastSaved)
    status = 'Saved at ' + timeFormat.format(new Date(lastSaved)) + '.';
  else if (loaded && !saved) status = 'No ' + brandKindLabel[kind] + ' brand saved yet.';

  const kindLabel = brandKindLabel[kind];
  return (
    <VStack align="stretch" gap={{ base: 6, md: 8 }}>
      <Box>
        <Heading as="h1" size={{ base: '2xl', md: '3xl' }}>
          Brand Studio
        </Heading>
        <Text color="fg.muted" mt={1.5}>
          Your TaskForge and personal brands: colors, fonts, logos, voice and writing style. Text
          only, kept private to your account. Contrast checks are rule-based.
        </Text>
        <Text
          ref={statusRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          fontSize="sm"
          color="fg.muted"
          mt={1}
          _focusVisible={{ outline: '2px solid', outlineColor: 'accent.teal' }}
        >
          {status}
        </Text>
      </Box>

      {loadError && !read.pending ? (
        <VStack align="start" gap={2}>
          <Text role="alert" color="fg.error">
            {loadError}
          </Text>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setReloadKey((key) => key + 1);
              // The button leaves the page while loading, so focus moves to the status line.
              statusRef.current?.focus();
            }}
          >
            Retry loading brands
          </Button>
        </VStack>
      ) : draft ? (
        <>
          <Box {...panel}>
            <Field.Root maxW="20rem">
              <Field.Label>Brand profile</Field.Label>
              {/* A save in flight belongs to the profile on screen, so switching waits for it. */}
              <NativeSelect.Root disabled={write.pending}>
                <NativeSelect.Field
                  value={kind}
                  onChange={(event) => {
                    setSaveError(null);
                    setInvalidField(null);
                    setKind(event.target.value as BrandKind);
                  }}
                >
                  {BRAND_KINDS.map((option) => (
                    <option key={option} value={option}>
                      {brandKindLabel[option]}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
              <Field.HelperText>Unsaved edits stay when you switch profiles.</Field.HelperText>
            </Field.Root>
            {saved && (
              <Button
                size="sm"
                variant="outline"
                mt={4}
                onClick={() => downloadText(brandGuideFileName(saved), brandGuideMarkdown(saved))}
              >
                <LuDownload aria-hidden="true" focusable="false" />
                Download saved brand guide
              </Button>
            )}
          </Box>

          <chakra.form
            onSubmit={onSubmit}
            noValidate
            aria-labelledby="brand-form-heading"
            {...panel}
          >
            <Heading as="h2" id="brand-form-heading" size="md" mb={4}>
              Edit {kindLabel} brand
            </Heading>
            <VStack align="stretch" gap={5}>
              <Field.Root required invalid={invalidField === 'brand-name'}>
                <Field.Label>
                  Brand name
                  <Field.RequiredIndicator />
                </Field.Label>
                <Input
                  data-field="brand-name"
                  value={draft.name}
                  onChange={(event) => setField('name', event.target.value)}
                  maxLength={BRAND_NAME_MAX}
                />
              </Field.Root>
              <Field.Root>
                <Field.Label>Tagline (optional)</Field.Label>
                <Input
                  value={draft.tagline}
                  onChange={(event) => setField('tagline', event.target.value)}
                  maxLength={BRAND_TAGLINE_MAX}
                />
              </Field.Root>

              <ListSection
                id="brand-colors"
                title="Colors"
                hint="A name and a six-digit hex code, for example #0F766E."
                count={draft.colors.length}
                max={BRAND_COLORS_MAX}
                addLabel="Add color"
                onAdd={() => addRow('colors', { name: '', hex: '' })}
                addRef={addColorRef}
              >
                {draft.colors.map((color, index) => {
                  const number = index + 1;
                  const hex = normalizeHex(color.hex);
                  return (
                    <Box {...rowStyle} key={color.key}>
                      <HStack gap={3} align="end" flexWrap="wrap">
                        <Field.Root
                          flex="1"
                          minW="10rem"
                          invalid={invalidField === 'color-name-' + color.key}
                        >
                          <Field.Label>Color {number} name</Field.Label>
                          <Input
                            data-field={'color-name-' + color.key}
                            value={color.name}
                            onChange={(event) =>
                              setRow('colors', color.key, { name: event.target.value })
                            }
                            maxLength={BRAND_COLOR_NAME_MAX}
                          />
                        </Field.Root>
                        <Field.Root w="9rem" invalid={invalidField === 'color-hex-' + color.key}>
                          <Field.Label>Color {number} hex</Field.Label>
                          <Input
                            data-field={'color-hex-' + color.key}
                            value={color.hex}
                            onChange={(event) =>
                              setRow('colors', color.key, { hex: event.target.value })
                            }
                            maxLength={7}
                            spellCheck={false}
                            autoComplete="off"
                          />
                        </Field.Root>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => removeRow('colors', color.key)}
                          aria-label={'Remove color ' + number}
                        >
                          Remove
                        </Button>
                      </HStack>
                      {hex ? (
                        <HStack gap={2} mt={2} align="start">
                          <Box
                            aria-hidden="true"
                            flexShrink={0}
                            w={6}
                            h={6}
                            borderRadius="sm"
                            borderWidth="1px"
                            borderColor="border"
                            style={{ backgroundColor: hex }}
                          />
                          <Text fontSize="sm">
                            {hex}: {contrastText(contrastCheck(hex))}
                          </Text>
                        </HStack>
                      ) : (
                        color.hex.trim() && (
                          <Text fontSize="sm" color="fg.muted" mt={2}>
                            Not a six-digit hex code yet.
                          </Text>
                        )
                      )}
                    </Box>
                  );
                })}
              </ListSection>

              <ListSection
                id="brand-fonts"
                title="Fonts"
                hint="One family per role, for example Inter for headings."
                count={draft.fonts.length}
                max={BRAND_FONTS_MAX}
                addLabel="Add font"
                onAdd={() => {
                  const used = new Set(draft.fonts.map((font) => font.role));
                  const role = BRAND_FONT_ROLES.find((option) => !used.has(option)) ?? 'body';
                  addRow('fonts', { role, family: '' });
                }}
                addRef={addFontRef}
              >
                {draft.fonts.map((font, index) => {
                  const number = index + 1;
                  return (
                    <Box {...rowStyle} key={font.key}>
                      <HStack gap={3} align="end" flexWrap="wrap">
                        <Field.Root w="10rem" invalid={invalidField === 'font-role-' + font.key}>
                          <Field.Label>Font {number} role</Field.Label>
                          <NativeSelect.Root>
                            <NativeSelect.Field
                              data-field={'font-role-' + font.key}
                              value={font.role}
                              onChange={(event) =>
                                setRow('fonts', font.key, {
                                  role: event.target.value as BrandFontRole,
                                })
                              }
                            >
                              {BRAND_FONT_ROLES.map((option) => (
                                <option key={option} value={option}>
                                  {brandFontRoleLabel[option]}
                                </option>
                              ))}
                            </NativeSelect.Field>
                            <NativeSelect.Indicator />
                          </NativeSelect.Root>
                        </Field.Root>
                        <Field.Root
                          flex="1"
                          minW="10rem"
                          invalid={invalidField === 'font-family-' + font.key}
                        >
                          <Field.Label>Font {number} family</Field.Label>
                          <Input
                            data-field={'font-family-' + font.key}
                            value={font.family}
                            onChange={(event) =>
                              setRow('fonts', font.key, { family: event.target.value })
                            }
                            maxLength={BRAND_FONT_FAMILY_MAX}
                          />
                        </Field.Root>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => removeRow('fonts', font.key)}
                          aria-label={'Remove font ' + number}
                        >
                          Remove
                        </Button>
                      </HStack>
                    </Box>
                  );
                })}
              </ListSection>

              <ListSection
                id="brand-logos"
                title="Logos"
                hint="A full https link, or a path on this site such as /taskforge-logo.svg. TaskForge only stores the link."
                count={draft.logos.length}
                max={BRAND_LOGOS_MAX}
                addLabel="Add logo"
                onAdd={() => addRow('logos', { label: '', url: '' })}
                addRef={addLogoRef}
              >
                {draft.logos.map((logo, index) => {
                  const number = index + 1;
                  const url = logo.url.trim();
                  const href = url ? safeLogoHref(url) : null;
                  const label = logo.label.trim() || 'Logo ' + number;
                  return (
                    <Box {...rowStyle} key={logo.key}>
                      <HStack gap={3} align="end" flexWrap="wrap">
                        <Field.Root w="12rem" invalid={invalidField === 'logo-label-' + logo.key}>
                          <Field.Label>Logo {number} label</Field.Label>
                          <Input
                            data-field={'logo-label-' + logo.key}
                            value={logo.label}
                            onChange={(event) =>
                              setRow('logos', logo.key, { label: event.target.value })
                            }
                            maxLength={BRAND_LOGO_LABEL_MAX}
                          />
                        </Field.Root>
                        <Field.Root
                          flex="1"
                          minW="12rem"
                          invalid={invalidField === 'logo-url-' + logo.key}
                        >
                          <Field.Label>Logo {number} link</Field.Label>
                          <Input
                            data-field={'logo-url-' + logo.key}
                            value={logo.url}
                            onChange={(event) =>
                              setRow('logos', logo.key, { url: event.target.value })
                            }
                            maxLength={BRAND_LOGO_URL_MAX}
                            spellCheck={false}
                            autoComplete="off"
                          />
                        </Field.Root>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => removeRow('logos', logo.key)}
                          aria-label={'Remove logo ' + number}
                        >
                          Remove
                        </Button>
                      </HStack>
                      {href && isSitePath(href) ? (
                        // Only a saved path is loaded, so typing never requests each keystroke.
                        savedLogoUrls.has(href) ? (
                          <Image
                            src={href}
                            alt={label}
                            loading="lazy"
                            maxH={12}
                            maxW="12rem"
                            mt={2}
                          />
                        ) : (
                          <Text fontSize="sm" color="fg.muted" mt={2}>
                            The preview appears after you save.
                          </Text>
                        )
                      ) : href ? (
                        <Link
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          fontSize="sm"
                          color="accent.teal"
                          mt={2}
                          display="inline-flex"
                          aria-label={'Open ' + label + ' (opens in a new tab)'}
                        >
                          Open {label}
                          <LuExternalLink aria-hidden="true" focusable="false" />
                        </Link>
                      ) : (
                        url && (
                          <Text fontSize="sm" color="fg.muted" mt={2}>
                            Use a full https link or a path that starts with /.
                          </Text>
                        )
                      )}
                    </Box>
                  );
                })}
              </ListSection>

              <Field.Root>
                <Field.Label>Brand voice (optional)</Field.Label>
                <Textarea
                  value={draft.voice}
                  onChange={(event) => setField('voice', event.target.value)}
                  rows={3}
                  maxLength={BRAND_TEXT_MAX}
                />
                <Field.HelperText>
                  How the brand sounds, for example plain and warm.
                </Field.HelperText>
              </Field.Root>
              <Field.Root>
                <Field.Label>Writing style (optional)</Field.Label>
                <Textarea
                  value={draft.writingStyle}
                  onChange={(event) => setField('writingStyle', event.target.value)}
                  rows={3}
                  maxLength={BRAND_TEXT_MAX}
                />
                <Field.HelperText>
                  Rules for written copy, for example short sentences.
                </Field.HelperText>
              </Field.Root>

              <ListSection
                id="brand-prompts"
                title="Image prompts"
                hint="One line each, to reuse with an image tool of your choice. TaskForge does not generate images."
                count={draft.imagePrompts.length}
                max={BRAND_PROMPTS_MAX}
                addLabel="Add image prompt"
                onAdd={() => addRow('imagePrompts', { text: '' })}
                addRef={addPromptRef}
              >
                {draft.imagePrompts.map((prompt, index) => {
                  const number = index + 1;
                  return (
                    <Box {...rowStyle} key={prompt.key}>
                      <HStack gap={3} align="end" flexWrap="wrap">
                        <Field.Root
                          flex="1"
                          minW="12rem"
                          invalid={invalidField === 'prompt-' + prompt.key}
                        >
                          <Field.Label>Image prompt {number}</Field.Label>
                          <Input
                            data-field={'prompt-' + prompt.key}
                            value={prompt.text}
                            onChange={(event) =>
                              setRow('imagePrompts', prompt.key, { text: event.target.value })
                            }
                            maxLength={BRAND_PROMPT_MAX}
                          />
                        </Field.Root>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => removeRow('imagePrompts', prompt.key)}
                          aria-label={'Remove image prompt ' + number}
                        >
                          Remove
                        </Button>
                      </HStack>
                    </Box>
                  );
                })}
              </ListSection>

              {saveError && (
                <Text role="alert" color="fg.error">
                  {saveError}
                </Text>
              )}
              <Box>
                <Button type="submit" colorPalette="teal" loading={write.pending}>
                  <LuSave aria-hidden="true" focusable="false" />
                  Save brand
                </Button>
              </Box>
            </VStack>
          </chakra.form>
        </>
      ) : null}
    </VStack>
  );
};

export default BrandPage;
