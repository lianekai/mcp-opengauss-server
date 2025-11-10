/**
 * 🔒 安全测试 - 输入验证测试
 */

import { describe, it, expect } from 'vitest';
import {
  assertReadOnlyQuery,
  normalizeIdentifier,
  validateTableName,
  ValidationError,
} from '../src/utils/validation.fixed.js';

describe('SQL 注入防护测试', () => {
  describe('assertReadOnlyQuery', () => {
    // ===========================
    // 正常查询应该通过
    // ===========================
    
    it('应该允许简单的 SELECT 查询', () => {
      expect(() => {
        assertReadOnlyQuery('SELECT * FROM users');
      }).not.toThrow();
    });

    it('应该允许带 WHERE 的查询', () => {
      expect(() => {
        assertReadOnlyQuery('SELECT id, name FROM users WHERE age > 18');
      }).not.toThrow();
    });

    it('应该允许 JOIN 查询', () => {
      expect(() => {
        assertReadOnlyQuery(
          'SELECT u.name, o.total FROM users u JOIN orders o ON u.id = o.user_id'
        );
      }).not.toThrow();
    });

    it('应该允许 CTE (WITH) 查询', () => {
      expect(() => {
        assertReadOnlyQuery(
          'WITH ranked AS (SELECT *, ROW_NUMBER() OVER (ORDER BY id) as rn FROM users) SELECT * FROM ranked'
        );
      }).not.toThrow();
    });

    it('应该允许 EXPLAIN 查询', () => {
      expect(() => {
        assertReadOnlyQuery('EXPLAIN SELECT * FROM users');
      }).not.toThrow();
    });

    // ===========================
    // 多语句注入应该被阻止
    // ===========================
    
    it('应该阻止多语句查询（经典 SQL 注入）', () => {
      expect(() => {
        assertReadOnlyQuery('SELECT * FROM users; DROP TABLE users;');
      }).toThrow(ValidationError);
      expect(() => {
        assertReadOnlyQuery('SELECT * FROM users; DROP TABLE users;');
      }).toThrow('多语句');
    });

    it('应该阻止分号不在末尾的查询', () => {
      expect(() => {
        assertReadOnlyQuery('SELECT 1; SELECT 2');
      }).toThrow(ValidationError);
    });

    // ===========================
    // 危险关键字应该被阻止
    // ===========================
    
    it('应该阻止 INSERT 语句', () => {
      expect(() => {
        assertReadOnlyQuery('INSERT INTO users (name) VALUES ("hacker")');
      }).toThrow(ValidationError);
      expect(() => {
        assertReadOnlyQuery('INSERT INTO users (name) VALUES ("hacker")');
      }).toThrow('INSERT');
    });

    it('应该阻止 UPDATE 语句', () => {
      expect(() => {
        assertReadOnlyQuery('UPDATE users SET name = "hacker" WHERE id = 1');
      }).toThrow(ValidationError);
    });

    it('应该阻止 DELETE 语句', () => {
      expect(() => {
        assertReadOnlyQuery('DELETE FROM users WHERE id = 1');
      }).toThrow(ValidationError);
    });

    it('应该阻止 DROP 语句', () => {
      expect(() => {
        assertReadOnlyQuery('DROP TABLE users');
      }).toThrow(ValidationError);
    });

    it('应该阻止 CREATE 语句', () => {
      expect(() => {
        assertReadOnlyQuery('CREATE TABLE evil (id INT)');
      }).toThrow(ValidationError);
    });

    it('应该阻止 ALTER 语句', () => {
      expect(() => {
        assertReadOnlyQuery('ALTER TABLE users ADD COLUMN evil VARCHAR(255)');
      }).toThrow(ValidationError);
    });

    it('应该阻止 TRUNCATE 语句', () => {
      expect(() => {
        assertReadOnlyQuery('TRUNCATE TABLE users');
      }).toThrow(ValidationError);
    });

    it('应该阻止 GRANT 语句', () => {
      expect(() => {
        assertReadOnlyQuery('GRANT ALL PRIVILEGES ON users TO hacker');
      }).toThrow(ValidationError);
    });

    // ===========================
    // 危险函数应该被阻止
    // ===========================
    
    it('应该阻止 pg_read_file 函数', () => {
      expect(() => {
        assertReadOnlyQuery("SELECT pg_read_file('/etc/passwd')");
      }).toThrow(ValidationError);
      expect(() => {
        assertReadOnlyQuery("SELECT pg_read_file('/etc/passwd')");
      }).toThrow('危险函数');
    });

    it('应该阻止 pg_ls_dir 函数', () => {
      expect(() => {
        assertReadOnlyQuery("SELECT pg_ls_dir('/')");
      }).toThrow(ValidationError);
    });

    it('应该阻止 lo_import 函数', () => {
      expect(() => {
        assertReadOnlyQuery("SELECT lo_import('/tmp/evil.txt')");
      }).toThrow(ValidationError);
    });

    // ===========================
    // 文件操作应该被阻止
    // ===========================
    
    it('应该阻止 COPY 命令', () => {
      expect(() => {
        assertReadOnlyQuery("COPY users TO '/tmp/data.csv'");
      }).toThrow(ValidationError);
      expect(() => {
        assertReadOnlyQuery("COPY users TO '/tmp/data.csv'");
      }).toThrow('文件操作');
    });

    it('应该阻止 LOAD DATA 命令', () => {
      expect(() => {
        assertReadOnlyQuery("LOAD DATA INFILE '/tmp/evil.csv' INTO TABLE users");
      }).toThrow(ValidationError);
    });

    it('应该阻止 INTO OUTFILE', () => {
      expect(() => {
        assertReadOnlyQuery("SELECT * FROM users INTO OUTFILE '/tmp/data.txt'");
      }).toThrow(ValidationError);
    });

    // ===========================
    // 子查询写操作应该被阻止
    // ===========================
    
    it('应该阻止子查询中的 DELETE', () => {
      expect(() => {
        assertReadOnlyQuery(
          'SELECT * FROM (DELETE FROM users WHERE id = 1 RETURNING *) AS t'
        );
      }).toThrow(ValidationError);
      expect(() => {
        assertReadOnlyQuery(
          'SELECT * FROM (DELETE FROM users WHERE id = 1 RETURNING *) AS t'
        );
      }).toThrow('子查询');
    });

    it('应该阻止 RETURNING 子句', () => {
      expect(() => {
        assertReadOnlyQuery('SELECT * FROM users RETURNING *');
      }).toThrow(ValidationError);
    });

    // ===========================
    // 长度限制测试
    // ===========================
    
    it('应该阻止过长的查询', () => {
      const longQuery = 'SELECT * FROM users WHERE id = ' + '1'.repeat(20000);
      expect(() => {
        assertReadOnlyQuery(longQuery);
      }).toThrow(ValidationError);
      expect(() => {
        assertReadOnlyQuery(longQuery);
      }).toThrow('过长');
    });

    it('应该阻止空查询', () => {
      expect(() => {
        assertReadOnlyQuery('');
      }).toThrow(ValidationError);
      expect(() => {
        assertReadOnlyQuery('   ');
      }).toThrow(ValidationError);
    });

    // ===========================
    // NULL 字节注入
    // ===========================
    
    it('应该阻止 NULL 字节注入', () => {
      expect(() => {
        assertReadOnlyQuery('SELECT * FROM users WHERE name = \x00');
      }).toThrow(ValidationError);
      expect(() => {
        assertReadOnlyQuery('SELECT * FROM users WHERE name = \x00');
      }).toThrow('NULL 字节');
    });

    // ===========================
    // 过度嵌套
    // ===========================
    
    it('应该阻止过度嵌套的括号', () => {
      const deeplyNested = 'SELECT * FROM (' + '('.repeat(15) + 'SELECT 1' + ')'.repeat(16);
      expect(() => {
        assertReadOnlyQuery(deeplyNested);
      }).toThrow(ValidationError);
      expect(() => {
        assertReadOnlyQuery(deeplyNested);
      }).toThrow('嵌套过深');
    });
  });

  // ===========================
  // 标识符验证测试
  // ===========================
  
  describe('normalizeIdentifier', () => {
    it('应该接受合法的标识符', () => {
      expect(normalizeIdentifier('users')).toBe('users');
      expect(normalizeIdentifier('user_table')).toBe('user_table');
      expect(normalizeIdentifier('Table123')).toBe('Table123');
    });

    it('应该拒绝空标识符', () => {
      expect(() => normalizeIdentifier('')).toThrow(ValidationError);
      expect(() => normalizeIdentifier('  ')).toThrow(ValidationError);
      expect(() => normalizeIdentifier(undefined)).toThrow(ValidationError);
    });

    it('应该拒绝包含特殊字符的标识符', () => {
      expect(() => normalizeIdentifier('users; DROP TABLE')).toThrow(ValidationError);
      expect(() => normalizeIdentifier('user-table')).toThrow(ValidationError);
      expect(() => normalizeIdentifier('user table')).toThrow(ValidationError);
      expect(() => normalizeIdentifier('user.table')).toThrow(ValidationError);
    });

    it('应该拒绝以数字开头的标识符', () => {
      expect(() => normalizeIdentifier('123users')).toThrow(ValidationError);
      expect(() => normalizeIdentifier('123users')).toThrow('数字开头');
    });

    it('应该拒绝 SQL 关键字作为标识符', () => {
      expect(() => normalizeIdentifier('SELECT')).toThrow(ValidationError);
      expect(() => normalizeIdentifier('TABLE')).toThrow(ValidationError);
      expect(() => normalizeIdentifier('DROP')).toThrow(ValidationError);
      expect(() => normalizeIdentifier('SELECT')).toThrow('关键字');
    });

    it('应该拒绝过长的标识符', () => {
      const longIdentifier = 'a'.repeat(200);
      expect(() => normalizeIdentifier(longIdentifier)).toThrow(ValidationError);
      expect(() => normalizeIdentifier(longIdentifier)).toThrow('过长');
    });
  });

  // ===========================
  // 表名验证测试
  // ===========================
  
  describe('validateTableName', () => {
    it('应该接受合法的表名', () => {
      expect(() => validateTableName('users')).not.toThrow();
      expect(() => validateTableName('user_orders')).not.toThrow();
    });

    it('应该接受 schema.table 格式', () => {
      expect(() => validateTableName('public.users')).not.toThrow();
      expect(() => validateTableName('my_schema.user_orders')).not.toThrow();
    });

    it('应该拒绝空表名', () => {
      expect(() => validateTableName('')).toThrow(ValidationError);
      expect(() => validateTableName('  ')).toThrow(ValidationError);
    });

    it('应该拒绝多个点号', () => {
      expect(() => validateTableName('db.schema.table')).toThrow(ValidationError);
      expect(() => validateTableName('db.schema.table')).toThrow('点号');
    });

    it('应该拒绝包含非法字符的表名', () => {
      expect(() => validateTableName('user-table')).toThrow(ValidationError);
      expect(() => validateTableName('user table')).toThrow(ValidationError);
      expect(() => validateTableName('user;DROP')).toThrow(ValidationError);
    });

    it('应该拒绝过长的表名', () => {
      const longTableName = 'a'.repeat(100);
      expect(() => validateTableName(longTableName)).toThrow(ValidationError);
    });
  });
});

describe('边界情况测试', () => {
  it('应该处理末尾有分号的合法查询', () => {
    expect(() => {
      assertReadOnlyQuery('SELECT * FROM users;');
    }).not.toThrow();
  });

  it('应该处理带注释的查询', () => {
    expect(() => {
      assertReadOnlyQuery('SELECT * FROM users -- 这是注释');
    }).not.toThrow();

    expect(() => {
      assertReadOnlyQuery('/* 块注释 */ SELECT * FROM users');
    }).not.toThrow();
  });

  it('应该处理字符串中的分号', () => {
    expect(() => {
      assertReadOnlyQuery("SELECT * FROM users WHERE name = 'O\\'Brien; SELECT'");
    }).not.toThrow();
  });
});

