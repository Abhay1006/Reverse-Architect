import { describe, it, expect } from 'vitest';
import { detectSingleton } from '../src/analyzers/patterns/singleton.js';
import { detectObserver } from '../src/analyzers/patterns/observer.js';
import { detectFactory } from '../src/analyzers/patterns/factory.js';
import { detectBuilder } from '../src/analyzers/patterns/builder.js';
import { detectStrategies } from '../src/analyzers/patterns/strategy.js';
import { detectAdapters } from '../src/analyzers/patterns/adapter.js';
import { detectPatterns } from '../src/analyzers/patterns/index.js';
import { edge, graph, node } from './support/graph.js';

describe('singleton', () => {
  it('is high confidence with getInstance and an instance field', () => {
    const m = detectSingleton(node('Db', 'class', { methods: ['getInstance', 'save'], properties: ['instance'] }));
    expect(m?.confidence).toBe('high');
    expect(m?.reasons).toEqual(['has method "getInstance"', 'has property "instance"']);
  });

  it('accepts snake_case names', () => {
    expect(detectSingleton(node('Registry', 'class', { methods: ['get_instance'], properties: ['_instance'] }))?.confidence).toBe('high');
  });

  it('is medium with getInstance alone, and absent without it', () => {
    expect(detectSingleton(node('Db', 'class', { methods: ['getInstance'] }))?.confidence).toBe('medium');
    expect(detectSingleton(node('Db', 'class', { properties: ['instance'] }))).toBeNull();
  });
});

describe('observer', () => {
  it('needs both subscribe and notify methods for high confidence', () => {
    expect(detectObserver(node('Bus', 'class', { methods: ['subscribe', 'emit'] }))?.confidence).toBe('high');
    expect(detectObserver(node('Bus', 'class', { methods: ['add_listener', 'notify_all'] }))?.confidence).toBe('high');
    expect(detectObserver(node('Bus', 'class', { methods: ['emit'] }))?.confidence).toBe('low');
  });

  it('does not match "on" inside unrelated names', () => {
    // A substring match used to flag every class with a constructor.
    expect(detectObserver(node('Money', 'class', { methods: ['constructor', 'toJSON', 'format'] }))).toBeNull();
  });
});

describe('factory', () => {
  it('ranks named factories with creation methods highest', () => {
    expect(detectFactory(node('ShapeFactory', 'class', { methods: ['createCircle'] }))?.confidence).toBe('high');
    expect(detectFactory(node('Shapes', 'class', { methods: ['createCircle', 'makeSquare'] }))?.confidence).toBe('medium');
    expect(detectFactory(node('ShapeFactory', 'class', { methods: [] }))?.confidence).toBe('low');
  });

  it('leaves build* methods and *Builder names to the builder detector', () => {
    expect(detectFactory(node('QueryBuilder', 'class', { methods: ['buildQuery', 'build'] }))).toBeNull();
  });

  it('matches the prefix only', () => {
    expect(detectFactory(node('Cache', 'class', { methods: ['recreate', 'remake'] }))).toBeNull();
  });
});

describe('builder', () => {
  it('needs build() plus step methods', () => {
    expect(detectBuilder(node('Req', 'class', { methods: ['withUrl', 'withBody', 'build'] }))?.confidence).toBe('high');
    expect(detectBuilder(node('Req', 'class', { methods: ['with_url', 'set_body', 'build'] }))?.confidence).toBe('high');
    expect(detectBuilder(node('Req', 'class', { methods: ['withUrl', 'build'] }))?.confidence).toBe('medium');
    expect(detectBuilder(node('ReqBuilder', 'class', { methods: ['build'] }))?.confidence).toBe('high');
  });

  it('does not treat words that merely start with "set" or "add" as steps', () => {
    expect(detectBuilder(node('Account', 'class', { methods: ['settle', 'address', 'build'] }))).toBeNull();
  });
});

describe('strategy', () => {
  const impls = (target: string, ...names: string[]) => names.map(n => edge(`entity:${n}`, `entity:${target}`, 'implements'));

  it('finds an interface with interchangeable implementations', () => {
    const g = graph(
      [node('entity:PaymentStrategy', 'interface', { methods: ['pay', 'refund'] }), node('entity:Card', 'class'), node('entity:Paypal', 'class')],
      impls('PaymentStrategy', 'Card', 'Paypal'),
    );
    const [m] = detectStrategies(g);
    expect(m).toMatchObject({ nodeId: 'entity:PaymentStrategy', pattern: 'strategy', confidence: 'high' });
    expect(m?.relatedNodeIds).toEqual(['entity:Card', 'entity:Paypal']);
  });

  it('accepts an unnamed single-operation interface at medium confidence', () => {
    const g = graph(
      [node('entity:Compressor', 'interface', { methods: ['compress'] }), node('entity:Gzip', 'class'), node('entity:Zstd', 'class')],
      impls('Compressor', 'Gzip', 'Zstd'),
    );
    expect(detectStrategies(g)[0]?.confidence).toBe('medium');
  });

  it('ignores ordinary interfaces and single implementations', () => {
    const wide = graph(
      [node('entity:Repo', 'interface', { methods: ['get', 'put'] }), node('entity:A', 'class'), node('entity:B', 'class')],
      impls('Repo', 'A', 'B'),
    );
    const single = graph([node('entity:SortStrategy', 'interface'), node('entity:Quick', 'class')], impls('SortStrategy', 'Quick'));
    expect(detectStrategies(wide)).toEqual([]);
    expect(detectStrategies(single)).toEqual([]);
  });
});

describe('adapter', () => {
  it('is high confidence when the adapter implements a target type', () => {
    const g = graph([node('entity:StripeAdapter', 'class'), node('entity:Payment', 'interface')], [edge('entity:StripeAdapter', 'entity:Payment', 'implements')]);
    expect(detectAdapters(g)[0]).toMatchObject({ confidence: 'high', relatedNodeIds: ['entity:Payment'] });
  });

  it('is medium on the name alone', () => {
    expect(detectAdapters(graph([node('entity:FetchWrapper', 'class')]))[0]?.confidence).toBe('medium');
  });
});

describe('detectPatterns', () => {
  it('drops low-confidence matches', () => {
    const g = graph([node('entity:Clicker', 'class', { methods: ['emit'] }), node('entity:Db', 'class', { methods: ['getInstance'] })]);
    expect(detectPatterns(g).map(m => m.pattern)).toEqual(['singleton']);
  });
});
