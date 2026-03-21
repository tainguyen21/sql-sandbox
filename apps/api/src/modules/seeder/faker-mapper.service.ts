import { Injectable } from '@nestjs/common';
import { Faker, en, de, fr, es, pt_BR, ja, ko, zh_CN, ar, ru } from '@faker-js/faker';

/** Map of locale string to faker locale object */
const LOCALE_MAP: Record<string, any> = { en, de, fr, es, pt_BR, ja, ko, zh_CN, ar, ru };

/** Column name pattern → faker generator key */
const COLUMN_NAME_PATTERNS: Array<{ regex: RegExp; generate: (f: Faker) => any }> = [
  { regex: /email/i, generate: (f) => f.internet.email() },
  { regex: /phone|mobile|cell/i, generate: (f) => f.phone.number() },
  { regex: /first_?name|firstname/i, generate: (f) => f.person.firstName() },
  { regex: /last_?name|lastname|surname/i, generate: (f) => f.person.lastName() },
  { regex: /full_?name|username|display_?name/i, generate: (f) => f.person.fullName() },
  { regex: /^name$/i, generate: (f) => f.person.fullName() },
  { regex: /title/i, generate: (f) => f.lorem.words(3) },
  { regex: /city/i, generate: (f) => f.location.city() },
  { regex: /country/i, generate: (f) => f.location.country() },
  { regex: /state|province/i, generate: (f) => f.location.state() },
  { regex: /address|street/i, generate: (f) => f.location.streetAddress() },
  { regex: /zip|postal/i, generate: (f) => f.location.zipCode() },
  { regex: /lat(itude)?/i, generate: (f) => f.location.latitude() },
  { regex: /lon(gitude)?/i, generate: (f) => f.location.longitude() },
  { regex: /url|website|homepage/i, generate: (f) => f.internet.url() },
  { regex: /avatar|image|photo|picture/i, generate: (f) => f.image.url() },
  { regex: /ip_?address|ip/i, generate: (f) => f.internet.ip() },
  { regex: /price|cost|amount|salary/i, generate: (f) => parseFloat(f.commerce.price()) },
  { regex: /product_?name|product/i, generate: (f) => f.commerce.productName() },
  { regex: /description|bio|summary|content|body/i, generate: (f) => f.lorem.paragraph() },
  { regex: /note|comment|remark/i, generate: (f) => f.lorem.sentence() },
  { regex: /company|organization|org/i, generate: (f) => f.company.name() },
  { regex: /color|colour/i, generate: (f) => f.color.human() },
  { regex: /age/i, generate: (f) => f.number.int({ min: 1, max: 100 }) },
  { regex: /score|rating/i, generate: (f) => f.number.int({ min: 1, max: 10 }) },
  { regex: /quantity|qty|count/i, generate: (f) => f.number.int({ min: 1, max: 1000 }) },
  { regex: /status/i, generate: (f) => f.helpers.arrayElement(['active', 'inactive', 'pending']) },
  { regex: /gender/i, generate: (f) => f.helpers.arrayElement(['male', 'female', 'other']) },
  { regex: /role/i, generate: (f) => f.helpers.arrayElement(['admin', 'user', 'moderator']) },
  { regex: /category|type|kind/i, generate: (f) => f.commerce.department() },
  { regex: /tag/i, generate: (f) => f.lorem.word() },
  { regex: /slug/i, generate: (f) => f.helpers.slugify(f.lorem.words(2)) },
];

/** PG data type → default faker generator */
const PG_TYPE_GENERATORS: Record<string, (f: Faker) => any> = {
  'integer': (f) => f.number.int({ min: 1, max: 100000 }),
  'bigint': (f) => f.number.int({ min: 1, max: 1000000 }),
  'smallint': (f) => f.number.int({ min: 1, max: 1000 }),
  'serial': (f) => f.number.int({ min: 1, max: 100000 }),
  'bigserial': (f) => f.number.int({ min: 1, max: 1000000 }),
  'numeric': (f) => parseFloat(f.number.float({ min: 0, max: 10000, fractionDigits: 2 }).toFixed(2)),
  'decimal': (f) => parseFloat(f.number.float({ min: 0, max: 10000, fractionDigits: 2 }).toFixed(2)),
  'real': (f) => f.number.float({ min: 0, max: 1000, fractionDigits: 2 }),
  'double precision': (f) => f.number.float({ min: 0, max: 1000000, fractionDigits: 4 }),
  'text': (f) => f.lorem.words(3),
  'varchar': (f) => f.lorem.words(2),
  'character varying': (f) => f.lorem.words(2),
  'char': (f) => f.string.alpha(1),
  'boolean': (f) => f.datatype.boolean(),
  'uuid': (f) => f.string.uuid(),
  'date': (f) => f.date.recent({ days: 365 }).toISOString().split('T')[0],
  'timestamp': (f) => f.date.recent({ days: 365 }).toISOString(),
  'timestamp without time zone': (f) => f.date.recent({ days: 365 }).toISOString(),
  'timestamp with time zone': (f) => f.date.recent({ days: 365 }).toISOString(),
  'timestamptz': (f) => f.date.recent({ days: 365 }).toISOString(),
  'time': (f) => `${f.number.int({ min: 0, max: 23 }).toString().padStart(2, '0')}:${f.number.int({ min: 0, max: 59 }).toString().padStart(2, '0')}:00`,
  'interval': () => '1 day',
  'jsonb': (f) => JSON.stringify({ value: f.lorem.word(), count: f.number.int({ min: 1, max: 100 }) }),
  'json': (f) => JSON.stringify({ value: f.lorem.word() }),
  'bytea': () => null,
  'inet': (f) => f.internet.ip(),
  'cidr': () => '192.168.0.0/24',
  'macaddr': (f) => f.internet.mac(),
};

export interface ColumnInfo {
  columnName: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isSerial: boolean;
}

@Injectable()
export class FakerMapperService {
  /** Build a Faker instance for the given locale */
  buildFaker(locale: string): Faker {
    const localeData = LOCALE_MAP[locale] || en;
    return new Faker({ locale: localeData });
  }

  /**
   * Generate a value for a column.
   * Priority: column name pattern > PG type fallback.
   * Returns null for serial PKs (let DB generate them).
   */
  generateValue(faker: Faker, col: ColumnInfo, nullProbability = 0.05): any {
    // Serial PKs are auto-generated — skip
    if (col.isPrimaryKey && col.isSerial) return undefined;

    // Nullable columns: occasionally emit null
    if (col.isNullable && Math.random() < nullProbability) return null;

    // Context-aware column name patterns
    for (const pattern of COLUMN_NAME_PATTERNS) {
      if (pattern.regex.test(col.columnName)) {
        return pattern.generate(faker);
      }
    }

    // PG type fallback — normalize type string
    const normalizedType = col.dataType.toLowerCase().replace(/\(\d+\)/g, '').trim();
    const generator = PG_TYPE_GENERATORS[normalizedType];
    if (generator) return generator(faker);

    // Final fallback
    return faker.lorem.word();
  }
}
