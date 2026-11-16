import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';
import { BrandUnavailableError, findBrandsByOwner, saveBrand } from '../../services/brandService';

jest.mock('../../services/brandService', () => {
  class BrandUnavailableError extends Error {}
  return { BrandUnavailableError, findBrandsByOwner: jest.fn(), saveBrand: jest.fn() };
});

const userId = '507f1f77bcf86cd799439011';
const authorization = { Authorization: 'Bearer ' + jwt.sign({ id: userId }, 'test-jwt-secret') };
const empty = {
  tagline: '',
  colors: [],
  fonts: [],
  logos: [],
  voice: '',
  writingStyle: '',
  imagePrompts: [],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('brand routes', () => {
  it.each([
    ['get', '/api/brands'],
    ['put', '/api/brands/personal'],
  ] as const)('requires authentication for %s %s', async (method, path) => {
    expect((await request(app)[method](path)).status).toBe(401);
  });

  it('lists the owner’s profiles', async () => {
    jest.mocked(findBrandsByOwner).mockResolvedValueOnce([] as never);
    expect((await request(app).get('/api/brands').set(authorization)).body).toEqual({
      brands: [],
    });
    expect(findBrandsByOwner).toHaveBeenCalledWith(userId);
  });

  it('saves only known fields, normalized', async () => {
    jest.mocked(saveBrand).mockResolvedValue({ name: 'TaskForge' } as never);
    const response = await request(app)
      .put('/api/brands/taskforge')
      .set(authorization)
      .send({
        name: '  TaskForge ',
        tagline: ' Forge your work ',
        colors: [{ name: ' Teal ', hex: '0f766e' }],
        fonts: [{ role: 'heading', family: ' Inter ' }],
        logos: [
          { label: 'Mark', url: '/taskforge-logo.svg' },
          { label: 'Wordmark', url: 'https://example.com/logo.png' },
        ],
        voice: ' Plain and direct ',
        writingStyle: 'Short sentences',
        imagePrompts: [' Anvil and spark, flat icon '],
        owner: 'someone-else',
        kind: 'personal',
        _id: 'x',
      });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ brand: { name: 'TaskForge' } });
    expect(saveBrand).toHaveBeenCalledWith(userId, 'taskforge', {
      name: 'TaskForge',
      tagline: 'Forge your work',
      colors: [{ name: 'Teal', hex: '#0F766E' }],
      fonts: [{ role: 'heading', family: 'Inter' }],
      logos: [
        { label: 'Mark', url: '/taskforge-logo.svg' },
        { label: 'Wordmark', url: 'https://example.com/logo.png' },
      ],
      voice: 'Plain and direct',
      writingStyle: 'Short sentences',
      imagePrompts: ['Anvil and spark, flat icon'],
    });
  });

  it('treats missing or null optional fields as empty', async () => {
    jest.mocked(saveBrand).mockResolvedValue({} as never);
    await request(app).put('/api/brands/personal').set(authorization).send({
      name: 'Me',
      colors: null,
    });
    expect(saveBrand).toHaveBeenCalledWith(userId, 'personal', { name: 'Me', ...empty });
  });

  it('answers 404 for an unknown kind', async () => {
    const response = await request(app)
      .put('/api/brands/company')
      .set(authorization)
      .send({ name: 'X' });
    expect(response.status).toBe(404);
    expect(saveBrand).not.toHaveBeenCalled();
  });

  it.each([
    [{}, 'Brand name is required'],
    [{ name: '   ' }, 'Brand name is required'],
    [{ name: 'n'.repeat(81) }, 'Brand name is too long'],
    [{ name: 'X', tagline: 't'.repeat(161) }, 'Tagline is too long'],
    [{ name: 'X', colors: 'teal' }, 'Invalid colors'],
    [
      { name: 'X', colors: [{ name: 'Teal', hex: '#0F76' }] },
      'Use a six-digit hex color, for example #0F766E',
    ],
    [{ name: 'X', colors: [{ hex: '#000000' }] }, 'Color name is required'],
    [
      { name: 'X', colors: Array.from({ length: 13 }, () => ({ name: 'C', hex: '#000000' })) },
      'Too many colors',
    ],
    [{ name: 'X', fonts: [{ role: 'title', family: 'Inter' }] }, 'Invalid fonts'],
    [{ name: 'X', fonts: [{ role: 'body', family: '' }] }, 'Font family is required'],
    [
      { name: 'X', logos: [{ label: 'L', url: 'http://example.com/l.png' }] },
      'Logo link must be an https address or a path such as /logo.svg',
    ],
    [
      { name: 'X', logos: [{ label: 'L', url: '//evil.example/l.png' }] },
      'Logo link must be an https address or a path such as /logo.svg',
    ],
    [
      { name: 'X', logos: [{ label: 'L', url: 'javascript:alert(1)' }] },
      'Logo link must be an https address or a path such as /logo.svg',
    ],
    [{ name: 'X', voice: { $ne: '' } }, 'Invalid brand voice'],
    [{ name: 'X', writingStyle: 'w'.repeat(2001) }, 'Writing style is too long'],
    [{ name: 'X', imagePrompts: ['p'.repeat(501)] }, 'Image prompt is too long'],
    [{ name: 'X', imagePrompts: Array.from({ length: 11 }, () => 'p') }, 'Too many image prompts'],
  ])('rejects %j', async (body, message) => {
    const response = await request(app).put('/api/brands/personal').set(authorization).send(body);
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message });
    expect(saveBrand).not.toHaveBeenCalled();
  });

  it('refuses a non-object body', async () => {
    const array = await request(app).put('/api/brands/personal').set(authorization).send(['x']);
    expect(array.status).toBe(400);
    expect(array.body).toEqual({ message: 'Invalid brand' });
    const text = await request(app)
      .put('/api/brands/personal')
      .set(authorization)
      .set('Content-Type', 'text/plain')
      .send('name');
    expect(text.status).toBe(400);
    expect(saveBrand).not.toHaveBeenCalled();
  });

  it('reports an unconfirmed index as 503 and other failures as 500', async () => {
    jest.mocked(saveBrand).mockRejectedValueOnce(new BrandUnavailableError());
    const unavailable = await request(app)
      .put('/api/brands/personal')
      .set(authorization)
      .send({ name: 'Me' });
    expect(unavailable.status).toBe(503);
    expect(unavailable.body).toEqual({ message: 'Brand profiles are temporarily unavailable' });
    jest.mocked(findBrandsByOwner).mockRejectedValueOnce(new Error('db down'));
    expect((await request(app).get('/api/brands').set(authorization)).status).toBe(500);
  });
});
