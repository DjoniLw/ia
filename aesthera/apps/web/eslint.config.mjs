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
}

export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  noNativeButtonRule,
]
