export default defineAppConfig({
  ui: {
    colors: { primary: 'indigo', neutral: 'zinc' },
    dropdownMenu: {
      slots: {
        content: 'nuxt-ui-scope w-[270px] max-w-[calc(100vw-16px)]',
        item: 'min-h-[36px] px-3 py-2 text-[13px] gap-3',
        itemLeadingIcon: 'size-[17px]',
        label: 'px-3 py-3 text-[13px]',
        itemDescription: 'text-[12px] truncate',
      },
    },
  },
  icon: { mode: 'svg' },
})
