// eslint.config.mjs — Aesthera Web
// Regra: proibir <button> nativo em .tsx — usar <Button> do design system (shadcn/ui)
// Exceção: className contendo "rounded-full" (pill/chip de filtro) é permitido

import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

const noNativeButtonRule = {
  name: 'aesthera/no-native-button',
  plugins: {
    aesthera: {
      rules: {
        'no-native-button': {
          meta: {
            type: 'problem',
            docs: {
              description:
                'Proíbe uso de <button> nativo. Use <Button> do design system (components/ui/button). Exceção: className contendo "rounded-full" (pill de filtro).',
            },
            schema: [],
            messages: {
              useDesignSystem:
                'Use <Button> do design system em vez de <button> nativo. Importe de "components/ui/button".',
            },
          },
          create(context) {
            return {
              JSXOpeningElement(node) {
                if (node.name && node.name.name === 'button') {
                  // Verifica se há className com rounded-full (pill de filtro — exceção permitida)
                  const classNameAttr = node.attributes.find(
                    (attr) =>
                      attr.type === 'JSXAttribute' &&
                      attr.name &&
                      attr.name.name === 'className',
                  )
                  if (classNameAttr) {
                    const value = classNameAttr.value
                    if (
                      value &&
                      value.type === 'Literal' &&
                      typeof value.value === 'string' &&
                      value.value.includes('rounded-full')
                    ) {
                      return // Exceção: pill/chip de filtro
                    }
                    if (
                      value &&
                      value.type === 'JSXExpressionContainer' &&
                      value.expression &&
                      value.expression.type === 'Literal' &&
                      typeof value.expression.value === 'string' &&
                      value.expression.value.includes('rounded-full')
                    ) {
                      return // Exceção: pill/chip de filtro via expressão
                    }
                    // Exceção: ['rounded-full ...', ...].join(' ')
                    if (
                      value &&
                      value.type === 'JSXExpressionContainer' &&
                      value.expression &&
                      value.expression.type === 'CallExpression' &&
                      value.expression.callee?.type === 'MemberExpression' &&
                      value.expression.callee?.property?.name === 'join' &&
                      value.expression.callee?.object?.type === 'ArrayExpression'
                    ) {
                      const elements = value.expression.callee.object.elements
                      if (
                        elements.some(
                          (el) =>
                            el &&
                            el.type === 'Literal' &&
                            typeof el.value === 'string' &&
                            el.value.includes('rounded-full'),
                        )
                      ) {
                        return // Exceção: pill/chip de filtro via array.join(' ')
                      }
                    }
                  }
                  context.report({ node, messageId: 'useDesignSystem' })
                }
              },
            }
          },
        },
      },
    },
  },
  rules: {
    'aesthera/no-native-button': 'error',
  },
  files: ['app/**/*.tsx', 'components/**/*.tsx'],
  ignores: [
    // Primitivos do design system — usam <button> nativo legitimamente
    'components/ui/**',
    // Violações pré-existentes — migrar para <Button> em PRs dedicados
    'app/(dashboard)/**',
    'app/pay/**',
    'app/sign/**',
    'components/body-measurements/**',
    'components/chat-panel.tsx',
    'components/payment-modal.tsx',
    'components/receive-manual-modal.tsx',
    'components/sell-product-form.tsx',
    'components/user-nav.tsx',
  ],
}

// Override para arquivos com violações pré-existentes: downgrade de error → warn
// para não bloquear o build enquanto a migração não está concluída.
const legacyRuleOverrides = {
  name: 'aesthera/legacy-overrides',
  files: [
    'app/(dashboard)/**/*.tsx',
    'app/(dashboard)/**/*.ts',
    'components/body-measurements/**/*.tsx',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/no-unused-expressions': 'warn',
    'react/no-unescaped-entities': 'warn',
  },
}

export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  noNativeButtonRule,
  legacyRuleOverrides,
]
