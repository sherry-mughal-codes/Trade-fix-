import bcrypt from 'bcryptjs'

import { PERMISSIONS, SYSTEM_ROLES } from '../lib/permissions'

const { PrismaClient } = require('@prisma/client') as { PrismaClient: new () => any }
const prisma: any = new PrismaClient()

function monthBounds(date: Date) {
  const year = date.getFullYear()
  const month = date.getMonth()
  return {
    start: new Date(year, month, 1),
    end: new Date(year, month + 1, 0),
  }
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

async function nextInvoiceNumber() {
  const settings = await prisma.companySettings.findUnique({ where: { id: 'default' } })
  if (!settings) {
    throw new Error('Company settings not found')
  }

  const invoiceNumber = `${settings.invoicePrefix}${settings.invoiceCurrentNumber}`
  await prisma.companySettings.update({
    where: { id: settings.id },
    data: {
      invoiceCurrentNumber: { increment: 1 },
    },
  })

  return invoiceNumber
}

async function upsertEmployee(data: {
  name: string
  email: string
  phone: string
  address: string
  ctc: number
  joinDate: Date
  status: string
}) {
  const existing = await prisma.employee.findFirst({ where: { name: data.name } })
  if (existing) {
    return prisma.employee.update({
      where: { id: existing.id },
      data,
    })
  }

  return prisma.employee.create({ data })
}

async function upsertCustomer(data: {
  name: string
  email: string
  phone: string
  address: string
  contactPerson: string
  ntn: string
  strn: string
  companyTypeId: string
  monthlyCharge: number
  invoiceCreationDay: number
  dueDayOfMonth: number
  billingStartDate: Date
  services: Array<{ id: string; startDate: Date; endDate?: Date | null }>
}) {
  const customer = await prisma.party.upsert({
    where: { name: data.name },
    update: {
      type: 'CUSTOMER',
      email: data.email,
      phone: data.phone,
      address: data.address,
      contactPerson: data.contactPerson,
      ntn: data.ntn,
      strn: data.strn,
      currency: 'PKR',
      companyTypeId: data.companyTypeId,
      isActive: true,
    },
    create: {
      name: data.name,
      type: 'CUSTOMER',
      email: data.email,
      phone: data.phone,
      address: data.address,
      contactPerson: data.contactPerson,
      ntn: data.ntn,
      strn: data.strn,
      currency: 'PKR',
      companyTypeId: data.companyTypeId,
      isActive: true,
    },
  })

  await prisma.customerBillingProfile.upsert({
    where: { customerId: customer.id },
    update: {
      monthlyCharge: data.monthlyCharge,
      invoiceCreationDay: data.invoiceCreationDay,
      dueDayOfMonth: data.dueDayOfMonth,
      billingStartDate: data.billingStartDate,
      autoCreateInvoices: true,
      isBillable: true,
    },
    create: {
      customerId: customer.id,
      monthlyCharge: data.monthlyCharge,
      invoiceCreationDay: data.invoiceCreationDay,
      dueDayOfMonth: data.dueDayOfMonth,
      billingStartDate: data.billingStartDate,
      autoCreateInvoices: true,
      isBillable: true,
    },
  })

  for (const service of data.services) {
    await prisma.customerServiceCommitment.upsert({
      where: {
        customerId_serviceId: {
          customerId: customer.id,
          serviceId: service.id,
        },
      },
      update: {
        startDate: service.startDate,
        endDate: service.endDate || null,
        isActive: true,
      },
      create: {
        customerId: customer.id,
        serviceId: service.id,
        startDate: service.startDate,
        endDate: service.endDate || null,
        isActive: true,
      },
    })
  }

  return customer
}

async function upsertLitigationCase(data: {
  litigationType: string
  caseReferenceNumber: string
  customerId: string
  taxYearId: string
  sectionId: string
  forumId?: string | null
  responsiblePersonId: string
  responsibleManagerId: string
  date: Date
  isBillable: boolean
  linkedLitigationId?: string | null
  remarks: string
}) {
  const existing = await prisma.litigationCase.findFirst({
    where: {
      litigationType: data.litigationType,
      caseReferenceNumber: data.caseReferenceNumber,
    },
  })

  if (existing) {
    return prisma.litigationCase.update({
      where: { id: existing.id },
      data,
    })
  }

  return prisma.litigationCase.create({ data })
}

async function replaceLitigationLogs(
  litigationCaseId: string,
  logs: Array<{
    logType: string
    date: Date
    remarks: string
    eventDate?: Date | null
    secondEventDate?: Date | null
    outcomeStatus?: string | null
  }>
) {
  await prisma.litigationLog.deleteMany({ where: { litigationCaseId } })

  for (const log of logs) {
    await prisma.litigationLog.create({
      data: {
        litigationCaseId,
        logType: log.logType,
        date: log.date,
        remarks: log.remarks,
        eventDate: log.eventDate || null,
        secondEventDate: log.secondEventDate || null,
        outcomeStatus: log.outcomeStatus || null,
        detailsJson: JSON.stringify({
          eventDate: log.eventDate?.toISOString() || null,
          secondEventDate: log.secondEventDate?.toISOString() || null,
          outcomeStatus: log.outcomeStatus || null,
        }),
      },
    })
  }

  const latestLog = logs[logs.length - 1] || null
  const isClosed = latestLog?.logType === 'ORDER_RECEIVED' || latestLog?.logType === 'JUDGMENT'
  const status = latestLog
    ? isClosed
      ? latestLog.outcomeStatus === 'IN_FAVOUR'
        ? 'CLOSED_IN_FAVOUR'
        : 'CLOSED_AGAINST'
      : latestLog.logType
    : 'OPEN'

  await prisma.litigationCase.update({
    where: { id: litigationCaseId },
    data: {
      latestActivityAt: latestLog?.date || null,
      latestActivityType: latestLog?.logType || null,
      status,
      isClosed,
      closedAt: isClosed ? latestLog?.date || null : null,
    },
  })
}

async function upsertServiceCycle(data: {
  customerId: string
  serviceId: string
  commitmentId: string
  cycleMonth: number
  cycleYear: number
  periodStart: Date
  periodEnd: Date
  dueDate: Date
  status: string
  completedDate?: Date | null
  completedByEmployeeId?: string | null
  notes?: string | null
}) {
  await prisma.serviceCycle.upsert({
    where: {
      customerId_serviceId_cycleMonth_cycleYear: {
        customerId: data.customerId,
        serviceId: data.serviceId,
        cycleMonth: data.cycleMonth,
        cycleYear: data.cycleYear,
      },
    },
    update: data,
    create: data,
  })
}

async function ensureBillingCycleInvoice(data: {
  customerId: string
  billingMonth: number
  billingYear: number
  periodStart: Date
  periodEnd: Date
  invoiceCreationDate: Date
  invoiceDueDate: Date
  amount: number
  cycleStatus: string
  invoiceStatus: string
  description: string
}) {
  const cycle = await prisma.billingCycle.upsert({
    where: {
      customerId_billingMonth_billingYear: {
        customerId: data.customerId,
        billingMonth: data.billingMonth,
        billingYear: data.billingYear,
      },
    },
    update: {
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      invoiceCreationDate: data.invoiceCreationDate,
      invoiceDueDate: data.invoiceDueDate,
      amount: data.amount,
      status: data.cycleStatus,
    },
    create: {
      customerId: data.customerId,
      billingMonth: data.billingMonth,
      billingYear: data.billingYear,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      invoiceCreationDate: data.invoiceCreationDate,
      invoiceDueDate: data.invoiceDueDate,
      amount: data.amount,
      status: data.cycleStatus,
    },
  })

  let invoice = cycle.invoiceId
    ? await prisma.invoice.findUnique({ where: { id: cycle.invoiceId } })
    : null

  if (!invoice) {
    const invoiceNumber = await nextInvoiceNumber()
    invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        type: 'SALE',
        status: data.invoiceStatus,
        date: data.invoiceCreationDate,
        dueDate: data.invoiceDueDate,
        partyId: data.customerId,
        currency: 'PKR',
        subTotal: data.amount,
        discountTotal: 0,
        grandTotal: data.amount,
        baseGrandTotal: data.amount,
        balanceAmount: data.invoiceStatus === 'PAID' ? 0 : data.amount,
        paidAmount: data.invoiceStatus === 'PAID' ? data.amount : 0,
        notes: 'Seeded TradeFix monthly billing data',
        items: {
          create: [
            {
              description: data.description,
              quantity: 1,
              unitPrice: data.amount,
              amount: data.amount,
            },
          ],
        },
      },
    })
  } else {
    invoice = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: data.invoiceStatus,
        date: data.invoiceCreationDate,
        dueDate: data.invoiceDueDate,
        currency: 'PKR',
        subTotal: data.amount,
        discountTotal: 0,
        grandTotal: data.amount,
        baseGrandTotal: data.amount,
        balanceAmount: data.invoiceStatus === 'PAID' ? 0 : data.amount,
        paidAmount: data.invoiceStatus === 'PAID' ? data.amount : 0,
        notes: 'Seeded TradeFix monthly billing data',
      },
    })
  }

  await prisma.billingCycle.update({
    where: { id: cycle.id },
    data: {
      invoiceId: invoice.id,
      status: data.cycleStatus,
    },
  })

  return invoice
}

async function ensureLitigationInvoice(data: {
  litigationCaseId: string
  customerId: string
  amount: number
  date: Date
  dueDate: Date
  status: string
  description: string
}) {
  const existing = await prisma.invoice.findFirst({
    where: { litigationCaseId: data.litigationCaseId },
  })

  if (existing) {
    return prisma.invoice.update({
      where: { id: existing.id },
      data: {
        status: data.status,
        date: data.date,
        dueDate: data.dueDate,
        currency: 'PKR',
        subTotal: data.amount,
        discountTotal: 0,
        grandTotal: data.amount,
        baseGrandTotal: data.amount,
        balanceAmount: data.status === 'PAID' ? 0 : data.amount,
        paidAmount: data.status === 'PAID' ? data.amount : 0,
        notes: 'Seeded TradeFix litigation billing data',
      },
    })
  }

  const invoiceNumber = await nextInvoiceNumber()
  return prisma.invoice.create({
    data: {
      invoiceNumber,
      type: 'SALE',
      status: data.status,
      date: data.date,
      dueDate: data.dueDate,
      partyId: data.customerId,
      litigationCaseId: data.litigationCaseId,
      currency: 'PKR',
      subTotal: data.amount,
      discountTotal: 0,
      grandTotal: data.amount,
      baseGrandTotal: data.amount,
      balanceAmount: data.status === 'PAID' ? 0 : data.amount,
      paidAmount: data.status === 'PAID' ? data.amount : 0,
      notes: 'Seeded TradeFix litigation billing data',
      items: {
        create: [
          {
            description: data.description,
            quantity: 1,
            unitPrice: data.amount,
            amount: data.amount,
          },
        ],
      },
    },
  })
}

async function main() {
  console.log('Seeding chart of accounts...')

  const accounts = [
    { code: '1000', name: 'Assets', type: 'ASSET', subType: null as string | null, isSystem: true, isGroup: true },
    { code: '2000', name: 'Liability', type: 'LIABILITY', subType: null as string | null, isSystem: true, isGroup: true },
    { code: '3000', name: 'Equity', type: 'EQUITY', subType: null as string | null, isSystem: true, isGroup: true },
    { code: '4000', name: 'Income', type: 'INCOME', subType: null as string | null, isSystem: true, isGroup: true },
    { code: '5000', name: 'Expense', type: 'EXPENSE', subType: null as string | null, isSystem: true, isGroup: true },

    { code: '1100', name: 'Cash', type: 'ASSET', subType: 'Cash', isSystem: true, isGroup: true },
    { code: '1101', name: 'Cash in Hand', type: 'ASSET', subType: 'Cash', isSystem: false, isGroup: false },
    { code: '1200', name: 'Bank', type: 'ASSET', subType: 'Bank', isSystem: true, isGroup: true },
    { code: '1201', name: 'Default Bank', type: 'ASSET', subType: 'Bank', isSystem: false, isGroup: false },
    { code: '1300', name: 'Accounts Receivable', type: 'ASSET', subType: 'Receivable', isSystem: true, isGroup: false },
    { code: '1400', name: 'Inventory', type: 'ASSET', subType: 'Inventory', isSystem: true, isGroup: false },

    { code: '2100', name: 'Accounts Payable', type: 'LIABILITY', subType: 'Payable', isSystem: true, isGroup: false },
    { code: '2200', name: 'Salary Payable', type: 'LIABILITY', subType: 'Payroll', isSystem: false, isGroup: false },

    { code: '3100', name: 'Temporary Opening', type: 'EQUITY', subType: 'Opening Balance', isSystem: false, isGroup: false },
    { code: '3200', name: 'Owners Shares', type: 'EQUITY', subType: 'Equity', isSystem: false, isGroup: false },

    { code: '4100', name: 'Sales Income', type: 'INCOME', subType: 'Sales', isSystem: false, isGroup: false },
    { code: '4200', name: 'Inventory Gain Adjustment', type: 'INCOME', subType: 'Inventory', isSystem: false, isGroup: false },

    { code: '5100', name: 'Cost of Goods Sold', type: 'EXPENSE', subType: 'COGS', isSystem: false, isGroup: false },
    { code: '5200', name: 'Inventory Loss Adjustment', type: 'EXPENSE', subType: 'Inventory', isSystem: false, isGroup: false },
    { code: '5300', name: 'Indirect Expense', type: 'EXPENSE', subType: 'Expense', isSystem: false, isGroup: true },

    { code: '5310', name: 'Salary Expense', type: 'EXPENSE', subType: 'Payroll', isSystem: false, isGroup: false },
    { code: '5320', name: 'Admin Expense', type: 'EXPENSE', subType: 'Expense', isSystem: false, isGroup: false },
    { code: '5330', name: 'Other Expenses', type: 'EXPENSE', subType: 'Expense', isSystem: false, isGroup: false },
  ]

  for (const account of accounts) {
    await prisma.account.upsert({
      where: { name: account.name },
      update: account,
      create: account,
    })
  }

  console.log('Keeping PKR as the only currency...')
  await prisma.currency.deleteMany({ where: { code: { not: 'PKR' } } })
  await prisma.currency.upsert({
    where: { code: 'PKR' },
    update: { name: 'Pakistani Rupee', symbol: 'Rs' },
    create: { code: 'PKR', name: 'Pakistani Rupee', symbol: 'Rs' },
  })

  await prisma.companySettings.upsert({
    where: { id: 'default' },
    update: {
      companyName: 'TradeFix',
      baseCurrency: 'PKR',
      defaultSalesAccount: 'Sales Income',
      defaultPurchaseAccount: 'Cost of Goods Sold',
      defaultReceivableAccount: 'Accounts Receivable',
      defaultPayableAccount: 'Accounts Payable',
      defaultInventoryAssetAccount: 'Inventory',
      defaultCogsAccount: 'Cost of Goods Sold',
      defaultStockAdjustmentGainAccount: 'Inventory Gain Adjustment',
      defaultStockAdjustmentLossAccount: 'Inventory Loss Adjustment',
      defaultOpeningStockAccount: 'Temporary Opening',
      defaultSalaryExpenseAccount: 'Salary Expense',
      defaultSalaryPayableAccount: 'Salary Payable',
      defaultCashGroupAccount: 'Cash',
      defaultBankGroupAccount: 'Bank',
      defaultExpenseGroupAccount: 'Indirect Expense',
    },
    create: {
      id: 'default',
      companyName: 'TradeFix',
      baseCurrency: 'PKR',
      defaultSalesAccount: 'Sales Income',
      defaultPurchaseAccount: 'Cost of Goods Sold',
      defaultReceivableAccount: 'Accounts Receivable',
      defaultPayableAccount: 'Accounts Payable',
      defaultInventoryAssetAccount: 'Inventory',
      defaultCogsAccount: 'Cost of Goods Sold',
      defaultStockAdjustmentGainAccount: 'Inventory Gain Adjustment',
      defaultStockAdjustmentLossAccount: 'Inventory Loss Adjustment',
      defaultOpeningStockAccount: 'Temporary Opening',
      defaultSalaryExpenseAccount: 'Salary Expense',
      defaultSalaryPayableAccount: 'Salary Payable',
      defaultCashGroupAccount: 'Cash',
      defaultBankGroupAccount: 'Bank',
      defaultExpenseGroupAccount: 'Indirect Expense',
    },
  })

  const email = 'zeeshan@firmeleven.com'
  const hashedPassword = await bcrypt.hash('12345678', 10)

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: 'Admin User',
      password: hashedPassword,
      isActive: true,
      isSuperadmin: true,
    },
    create: {
      email,
      name: 'Admin User',
      password: hashedPassword,
      isActive: true,
      isSuperadmin: true,
    },
  })

  console.log(`Ensured admin user: ${email}`)
  console.log('Seeding RBAC...')

  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: {
        label: permission.label,
        group: permission.group,
        order: permission.order || 0,
      },
      create: {
        key: permission.key,
        label: permission.label,
        group: permission.group,
        order: permission.order || 0,
      },
    })
  }

  const permissionRows = await prisma.permission.findMany()
  const roleByName = new Map<string, { id: string; name: string }>()

  for (const roleSeed of SYSTEM_ROLES) {
    const role = await prisma.role.upsert({
      where: { name: roleSeed.name },
      update: { isSystem: roleSeed.isSystem },
      create: { name: roleSeed.name, isSystem: roleSeed.isSystem },
    })
    roleByName.set(role.name, role)
  }

  for (const roleSeed of SYSTEM_ROLES) {
    const role = roleByName.get(roleSeed.name)
    if (!role) continue

    const allowAll = !!roleSeed.allowAll
    const allowed = new Set(roleSeed.allowedKeys || [])

    for (const permission of permissionRows) {
      const isAllowed = allowAll || allowed.has(permission.key)
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: { allowed: isAllowed },
        create: {
          roleId: role.id,
          permissionId: permission.id,
          allowed: isAllowed,
        },
      })
    }
  }

  const adminRole = roleByName.get('admin')
  if (adminRole) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: adminRole.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        roleId: adminRole.id,
      },
    })
  }

  console.log('Seeding TradeFix masters...')
  const currentYear = new Date().getFullYear()

  const taxYears = [
    { title: `${currentYear - 1}-${currentYear}`, startDate: new Date(`${currentYear - 1}-07-01`), endDate: new Date(`${currentYear}-06-30`), isActive: true },
    { title: `${currentYear}-${currentYear + 1}`, startDate: new Date(`${currentYear}-07-01`), endDate: new Date(`${currentYear + 1}-06-30`), isActive: true },
  ]
  const sections = [
    { title: 'Section 11', description: 'Sales tax proceedings', isActive: true },
    { title: 'Section 25', description: 'Record and notices', isActive: true },
    { title: 'Section 122', description: 'Income tax amendment', isActive: true },
    { title: 'Section 124', description: 'Best judgment assessment', isActive: true },
  ]
  const forums = [
    { litigationType: 'NOTICE_COMPLIANCE', title: 'ACIR', isActive: true },
    { litigationType: 'NOTICE_COMPLIANCE', title: 'DCIR', isActive: true },
    { litigationType: 'COMMISSIONER_APPEALS', title: 'Commissioner Appeals', isActive: true },
    { litigationType: 'ATIR', title: 'ATIR Bench', isActive: true },
    { litigationType: 'LAHORE_HIGH_COURT', title: 'Lahore High Court', isActive: true },
    { litigationType: 'FEDERAL_CONSTITUTIONAL_COURT', title: 'Federal Constitutional Court', isActive: true },
  ]
  const services = [
    { title: 'Monthly Sales Tax Return', type: 'MONTHLY', startMonth: 1, bufferDaysBeforeEnd: 5, isBillable: true, isActive: true },
    { title: 'Quarterly Withholding Statement', type: 'QUARTERLY', startMonth: 1, bufferDaysBeforeEnd: 7, isBillable: true, isActive: true },
    { title: 'Annual Income Tax Return', type: 'ANNUAL', startMonth: 7, bufferDaysBeforeEnd: 15, isBillable: true, isActive: true },
    { title: 'Audit Support', type: 'ANNUAL', startMonth: 7, bufferDaysBeforeEnd: 15, isBillable: false, isActive: true },
  ]
  const companyTypes = [
    { title: 'Private Limited', isActive: true },
    { title: 'Partnership', isActive: true },
    { title: 'Sole Proprietor', isActive: true },
    { title: 'Association of Persons', isActive: true },
  ]

  for (const taxYear of taxYears) {
    await prisma.taxYear.upsert({
      where: { title: taxYear.title },
      update: taxYear,
      create: taxYear,
    })
  }

  for (const section of sections) {
    await prisma.litigationSection.upsert({
      where: { title: section.title },
      update: section,
      create: section,
    })
  }

  for (const forum of forums) {
    await prisma.litigationForum.upsert({
      where: {
        litigationType_title: {
          litigationType: forum.litigationType,
          title: forum.title,
        },
      },
      update: forum,
      create: forum,
    })
  }

  for (const service of services) {
    await prisma.service.upsert({
      where: { title: service.title },
      update: service,
      create: service,
    })
  }

  for (const companyType of companyTypes) {
    await prisma.companyType.upsert({
      where: { title: companyType.title },
      update: companyType,
      create: companyType,
    })
  }

  console.log('Seeding operational TradeFix demo data...')

  const serviceByTitle = new Map<string, any>((await prisma.service.findMany()).map((service: any) => [service.title, service]))
  const companyTypeByTitle = new Map<string, any>((await prisma.companyType.findMany()).map((companyType: any) => [companyType.title, companyType]))
  const taxYear = await prisma.taxYear.findFirst({ where: { title: `${currentYear - 1}-${currentYear}` } })
  const sectionByTitle = new Map<string, any>((await prisma.litigationSection.findMany()).map((section: any) => [section.title, section]))
  const forumByKey = new Map<string, any>((await prisma.litigationForum.findMany()).map((forum: any) => [`${forum.litigationType}:${forum.title}`, forum]))

  if (!taxYear) {
    throw new Error('Seed tax year not found')
  }

  const manager = await upsertEmployee({
    name: 'Ayesha Khalid',
    email: 'ayesha.khalid@tradefix.local',
    phone: '0300-1111001',
    address: 'Gulberg III, Lahore',
    ctc: 275000,
    joinDate: new Date(`${currentYear - 2}-01-10`),
    status: 'ACTIVE',
  })
  const litigationOfficer = await upsertEmployee({
    name: 'Hamza Imran',
    email: 'hamza.imran@tradefix.local',
    phone: '0300-1111002',
    address: 'Johar Town, Lahore',
    ctc: 165000,
    joinDate: new Date(`${currentYear - 1}-03-01`),
    status: 'ACTIVE',
  })
  const taxAssociate = await upsertEmployee({
    name: 'Sana Tariq',
    email: 'sana.tariq@tradefix.local',
    phone: '0300-1111003',
    address: 'DHA Phase 5, Lahore',
    ctc: 145000,
    joinDate: new Date(`${currentYear - 1}-07-15`),
    status: 'ACTIVE',
  })
  const billingExecutive = await upsertEmployee({
    name: 'Bilal Ahmed',
    email: 'bilal.ahmed@tradefix.local',
    phone: '0300-1111004',
    address: 'Model Town, Lahore',
    ctc: 120000,
    joinDate: new Date(`${currentYear - 1}-09-01`),
    status: 'ACTIVE',
  })

  const privateLimitedId = companyTypeByTitle.get('Private Limited')?.id
  const partnershipId = companyTypeByTitle.get('Partnership')?.id
  const soleProprietorId = companyTypeByTitle.get('Sole Proprietor')?.id

  if (!privateLimitedId || !partnershipId || !soleProprietorId) {
    throw new Error('Required company types are missing')
  }

  const alphaCustomer = await upsertCustomer({
    name: 'Alpha Manufacturing (Pvt.) Ltd.',
    email: 'accounts@alphamfg.pk',
    phone: '042-35100001',
    address: 'Sundar Industrial Estate, Lahore',
    contactPerson: 'Umar Farooq',
    ntn: '3491827-4',
    strn: '3278410021135',
    companyTypeId: privateLimitedId,
    monthlyCharge: 85000,
    invoiceCreationDay: 3,
    dueDayOfMonth: 10,
    billingStartDate: new Date(`${currentYear - 1}-07-01`),
    services: [
      { id: serviceByTitle.get('Monthly Sales Tax Return')!.id, startDate: new Date(`${currentYear - 1}-07-01`) },
      { id: serviceByTitle.get('Quarterly Withholding Statement')!.id, startDate: new Date(`${currentYear - 1}-07-01`) },
    ],
  })
  const blueCustomer = await upsertCustomer({
    name: 'Blue Horizon Traders',
    email: 'finance@bluehorizon.pk',
    phone: '021-34880022',
    address: 'SITE Area, Karachi',
    contactPerson: 'Saad Qureshi',
    ntn: '5182734-9',
    strn: '7110045002211',
    companyTypeId: partnershipId,
    monthlyCharge: 60000,
    invoiceCreationDay: 5,
    dueDayOfMonth: 12,
    billingStartDate: new Date(`${currentYear - 1}-08-01`),
    services: [
      { id: serviceByTitle.get('Monthly Sales Tax Return')!.id, startDate: new Date(`${currentYear - 1}-08-01`) },
      { id: serviceByTitle.get('Annual Income Tax Return')!.id, startDate: new Date(`${currentYear - 1}-08-01`) },
    ],
  })
  const pakAgriCustomer = await upsertCustomer({
    name: 'Pak Agri Commodities',
    email: 'admin@pakagri.pk',
    phone: '051-2221144',
    address: 'I-9 Markaz, Islamabad',
    contactPerson: 'Kashif Mehmood',
    ntn: '6823110-6',
    strn: '4291147800042',
    companyTypeId: soleProprietorId,
    monthlyCharge: 45000,
    invoiceCreationDay: 2,
    dueDayOfMonth: 8,
    billingStartDate: new Date(`${currentYear - 1}-07-01`),
    services: [
      { id: serviceByTitle.get('Quarterly Withholding Statement')!.id, startDate: new Date(`${currentYear - 1}-07-01`) },
      { id: serviceByTitle.get('Annual Income Tax Return')!.id, startDate: new Date(`${currentYear - 1}-07-01`) },
    ],
  })
  const nexusCustomer = await upsertCustomer({
    name: 'Nexus Retail Chain',
    email: 'ceo@nexusretail.pk',
    phone: '042-35990077',
    address: 'Main Boulevard, Faisal Town, Lahore',
    contactPerson: 'Hina Shahid',
    ntn: '7753100-2',
    strn: '3287100987124',
    companyTypeId: privateLimitedId,
    monthlyCharge: 95000,
    invoiceCreationDay: 4,
    dueDayOfMonth: 11,
    billingStartDate: new Date(`${currentYear - 1}-10-01`),
    services: [
      { id: serviceByTitle.get('Monthly Sales Tax Return')!.id, startDate: new Date(`${currentYear - 1}-10-01`) },
      { id: serviceByTitle.get('Audit Support')!.id, startDate: new Date(`${currentYear - 1}-10-01`) },
    ],
  })

  const alphaNotice = await upsertLitigationCase({
    litigationType: 'NOTICE_COMPLIANCE',
    caseReferenceNumber: 'NC-2026-001',
    customerId: alphaCustomer.id,
    taxYearId: taxYear.id,
    sectionId: sectionByTitle.get('Section 11')!.id,
    forumId: forumByKey.get('NOTICE_COMPLIANCE:ACIR')!.id,
    responsiblePersonId: litigationOfficer.id,
    responsibleManagerId: manager.id,
    date: new Date(`${currentYear}-02-04`),
    isBillable: false,
    remarks: 'Notice issued regarding sales tax input adjustments for FY compliance review.',
  })
  const blueAppeal = await upsertLitigationCase({
    litigationType: 'COMMISSIONER_APPEALS',
    caseReferenceNumber: 'CA-2026-014',
    customerId: blueCustomer.id,
    taxYearId: taxYear.id,
    sectionId: sectionByTitle.get('Section 122')!.id,
    forumId: forumByKey.get('COMMISSIONER_APPEALS:Commissioner Appeals')!.id,
    responsiblePersonId: litigationOfficer.id,
    responsibleManagerId: manager.id,
    date: new Date(`${currentYear}-01-18`),
    isBillable: true,
    remarks: 'Appeal filed against amended assessment order for concealed income adjustments.',
  })
  const atirAppeal = await upsertLitigationCase({
    litigationType: 'ATIR',
    caseReferenceNumber: 'ATIR-2026-004',
    customerId: pakAgriCustomer.id,
    taxYearId: taxYear.id,
    sectionId: sectionByTitle.get('Section 122')!.id,
    forumId: forumByKey.get('ATIR:ATIR Bench')!.id,
    responsiblePersonId: taxAssociate.id,
    responsibleManagerId: manager.id,
    date: new Date(`${currentYear}-03-09`),
    isBillable: true,
    remarks: 'ATIR follow-up on withholding adjustments and disallowance matter.',
  })
  const lhcPetition = await upsertLitigationCase({
    litigationType: 'LAHORE_HIGH_COURT',
    caseReferenceNumber: 'LHC-2026-002',
    customerId: alphaCustomer.id,
    taxYearId: taxYear.id,
    sectionId: sectionByTitle.get('Section 124')!.id,
    forumId: forumByKey.get('LAHORE_HIGH_COURT:Lahore High Court')!.id,
    responsiblePersonId: litigationOfficer.id,
    responsibleManagerId: manager.id,
    date: new Date(`${currentYear}-04-21`),
    isBillable: true,
    linkedLitigationId: alphaNotice.id,
    remarks: 'Constitutional petition linked to underlying notice-compliance matter.',
  })
  const federalCourtCase = await upsertLitigationCase({
    litigationType: 'FEDERAL_CONSTITUTIONAL_COURT',
    caseReferenceNumber: 'FCC-2026-001',
    customerId: nexusCustomer.id,
    taxYearId: taxYear.id,
    sectionId: sectionByTitle.get('Section 25')!.id,
    forumId: forumByKey.get('FEDERAL_CONSTITUTIONAL_COURT:Federal Constitutional Court')!.id,
    responsiblePersonId: taxAssociate.id,
    responsibleManagerId: manager.id,
    date: new Date(`${currentYear}-01-07`),
    isBillable: true,
    remarks: 'Federal constitutional litigation over departmental jurisdiction and hearing process.',
  })

  await replaceLitigationLogs(alphaNotice.id, [
    {
      logType: 'NOTICE_RECEIVED',
      date: new Date(`${currentYear}-02-04T11:00:00`),
      remarks: 'Notice received from ACIR regarding input tax reconciliation.',
      eventDate: new Date(`${currentYear}-02-03`),
    },
    {
      logType: 'REPLY_PREPARATION',
      date: new Date(`${currentYear}-02-08T15:00:00`),
      remarks: 'Working papers and reconciliations prepared with client accounts team.',
    },
    {
      logType: 'REPLY_FILED',
      date: new Date(`${currentYear}-02-11T13:30:00`),
      remarks: 'Reply filed with annexures and ledger support.',
      eventDate: new Date(`${currentYear}-02-11`),
    },
  ])

  await replaceLitigationLogs(blueAppeal.id, [
    {
      logType: 'APPEAL_FILED',
      date: new Date(`${currentYear}-01-18T10:00:00`),
      remarks: 'Appeal filed before Commissioner Appeals.',
      eventDate: new Date(`${currentYear}-01-18`),
    },
    {
      logType: 'NOTICE_OF_HEARING_RECEIVED',
      date: new Date(`${currentYear}-02-03T16:00:00`),
      remarks: 'Hearing notice served for March proceedings.',
      eventDate: new Date(`${currentYear}-03-01`),
    },
    {
      logType: 'MAIN_APPEAL_HEARING',
      date: new Date(`${currentYear}-03-01T11:30:00`),
      remarks: 'Main hearing conducted with documentary submissions on record.',
      eventDate: new Date(`${currentYear}-03-01`),
    },
    {
      logType: 'ORDER_RECEIVED',
      date: new Date(`${currentYear}-03-18T12:15:00`),
      remarks: 'Commissioner Appeals accepted the taxpayer position in the final order.',
      eventDate: new Date(`${currentYear}-03-12`),
      secondEventDate: new Date(`${currentYear}-03-18`),
      outcomeStatus: 'IN_FAVOUR',
    },
  ])

  await replaceLitigationLogs(atirAppeal.id, [
    {
      logType: 'APPEAL_FILED',
      date: new Date(`${currentYear}-03-09T10:20:00`),
      remarks: 'Appeal filed before ATIR bench.',
      eventDate: new Date(`${currentYear}-03-09`),
    },
    {
      logType: 'STAY_APPLICATION',
      date: new Date(`${currentYear}-03-14T14:40:00`),
      remarks: 'Stay application moved to suspend recovery proceedings.',
      eventDate: new Date(`${currentYear}-03-14`),
    },
    {
      logType: 'FURTHER_HEARING',
      date: new Date(`${currentYear}-04-16T12:00:00`),
      remarks: 'Further hearing fixed after submission of paper book.',
      eventDate: new Date(`${currentYear}-04-25`),
    },
  ])

  await replaceLitigationLogs(lhcPetition.id, [
    {
      logType: 'NOTICE_OR_WRIT_FILED',
      date: new Date(`${currentYear}-04-21T09:30:00`),
      remarks: 'Writ petition filed before Lahore High Court.',
      eventDate: new Date(`${currentYear}-04-21`),
    },
    {
      logType: 'NOTICE_OF_HEARING_RECEIVED',
      date: new Date(`${currentYear}-05-03T16:10:00`),
      remarks: 'Court issued notice for preliminary hearing.',
      eventDate: new Date(`${currentYear}-05-14`),
    },
    {
      logType: 'HEARING',
      date: new Date(`${currentYear}-05-14T11:45:00`),
      remarks: 'Hearing conducted; respondent directed to submit comments.',
      eventDate: new Date(`${currentYear}-05-14`),
    },
  ])

  await replaceLitigationLogs(federalCourtCase.id, [
    {
      logType: 'APPEAL_FILED',
      date: new Date(`${currentYear}-01-07T10:00:00`),
      remarks: 'Appeal filed before federal constitutional forum.',
      eventDate: new Date(`${currentYear}-01-07`),
    },
    {
      logType: 'NOTICE_OF_HEARING_RECEIVED',
      date: new Date(`${currentYear}-02-05T13:15:00`),
      remarks: 'Notice of hearing received for February bench.',
      eventDate: new Date(`${currentYear}-02-20`),
    },
    {
      logType: 'JUDGMENT',
      date: new Date(`${currentYear}-03-28T15:35:00`),
      remarks: 'Judgment received against the taxpayer after final hearing.',
      eventDate: new Date(`${currentYear}-03-28`),
      outcomeStatus: 'AGAINST',
    },
  ])

  const commitments = await prisma.customerServiceCommitment.findMany({
    where: {
      customerId: {
        in: [alphaCustomer.id, blueCustomer.id, pakAgriCustomer.id, nexusCustomer.id],
      },
    },
  })

  const commitmentByKey = new Map(
    commitments.map((commitment: any) => [`${commitment.customerId}:${commitment.serviceId}`, commitment])
  )

  const currentMonthDate = addMonths(new Date(), 0)
  const previousMonthDate = addMonths(new Date(), -1)
  const monthlySalesTaxServiceId = serviceByTitle.get('Monthly Sales Tax Return')!.id
  const quarterlyWithholdingServiceId = serviceByTitle.get('Quarterly Withholding Statement')!.id
  const auditSupportServiceId = serviceByTitle.get('Audit Support')!.id

  const currentBounds = monthBounds(currentMonthDate)
  const previousBounds = monthBounds(previousMonthDate)
  const getCommitmentId = (customerId: string, serviceId: string) => {
    const commitment = commitmentByKey.get(`${customerId}:${serviceId}`) as any
    if (!commitment?.id) {
      throw new Error(`Commitment missing for ${customerId}:${serviceId}`)
    }

    return commitment.id as string
  }

  await upsertServiceCycle({
    customerId: alphaCustomer.id,
    serviceId: monthlySalesTaxServiceId,
    commitmentId: getCommitmentId(alphaCustomer.id, monthlySalesTaxServiceId),
    cycleMonth: previousMonthDate.getMonth() + 1,
    cycleYear: previousMonthDate.getFullYear(),
    periodStart: previousBounds.start,
    periodEnd: previousBounds.end,
    dueDate: new Date(previousMonthDate.getFullYear(), previousMonthDate.getMonth(), 18),
    status: 'COMPLETED',
    completedDate: new Date(previousMonthDate.getFullYear(), previousMonthDate.getMonth(), 16),
    completedByEmployeeId: litigationOfficer.id,
    notes: 'Sales tax return filed within due date.',
  })
  await upsertServiceCycle({
    customerId: alphaCustomer.id,
    serviceId: monthlySalesTaxServiceId,
    commitmentId: getCommitmentId(alphaCustomer.id, monthlySalesTaxServiceId),
    cycleMonth: currentMonthDate.getMonth() + 1,
    cycleYear: currentMonthDate.getFullYear(),
    periodStart: currentBounds.start,
    periodEnd: currentBounds.end,
    dueDate: new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), 18),
    status: 'PENDING',
    notes: 'Waiting for final sales register from client.',
  })
  await upsertServiceCycle({
    customerId: blueCustomer.id,
    serviceId: monthlySalesTaxServiceId,
    commitmentId: getCommitmentId(blueCustomer.id, monthlySalesTaxServiceId),
    cycleMonth: previousMonthDate.getMonth() + 1,
    cycleYear: previousMonthDate.getFullYear(),
    periodStart: previousBounds.start,
    periodEnd: previousBounds.end,
    dueDate: new Date(previousMonthDate.getFullYear(), previousMonthDate.getMonth(), 18),
    status: 'COMPLETED',
    completedDate: new Date(previousMonthDate.getFullYear(), previousMonthDate.getMonth(), 17),
    completedByEmployeeId: taxAssociate.id,
    notes: 'Return filed after reconciliation.',
  })
  await upsertServiceCycle({
    customerId: blueCustomer.id,
    serviceId: monthlySalesTaxServiceId,
    commitmentId: getCommitmentId(blueCustomer.id, monthlySalesTaxServiceId),
    cycleMonth: currentMonthDate.getMonth() + 1,
    cycleYear: currentMonthDate.getFullYear(),
    periodStart: currentBounds.start,
    periodEnd: currentBounds.end,
    dueDate: new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), 18),
    status: 'COMPLETED',
    completedDate: new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), 14),
    completedByEmployeeId: billingExecutive.id,
    notes: 'Current month service completed early.',
  })
  await upsertServiceCycle({
    customerId: pakAgriCustomer.id,
    serviceId: quarterlyWithholdingServiceId,
    commitmentId: getCommitmentId(pakAgriCustomer.id, quarterlyWithholdingServiceId),
    cycleMonth: currentMonthDate.getMonth() + 1,
    cycleYear: currentMonthDate.getFullYear(),
    periodStart: currentBounds.start,
    periodEnd: currentBounds.end,
    dueDate: new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), 15),
    status: 'OVERDUE',
    notes: 'Client has not shared contractor withholding summary yet.',
  })
  await upsertServiceCycle({
    customerId: nexusCustomer.id,
    serviceId: auditSupportServiceId,
    commitmentId: getCommitmentId(nexusCustomer.id, auditSupportServiceId),
    cycleMonth: previousMonthDate.getMonth() + 1,
    cycleYear: previousMonthDate.getFullYear(),
    periodStart: previousBounds.start,
    periodEnd: previousBounds.end,
    dueDate: new Date(previousMonthDate.getFullYear(), previousMonthDate.getMonth(), 25),
    status: 'COMPLETED',
    completedDate: new Date(previousMonthDate.getFullYear(), previousMonthDate.getMonth(), 24),
    completedByEmployeeId: manager.id,
    notes: 'Audit queries closed with management representation.',
  })

  const alphaPreviousInvoice = await ensureBillingCycleInvoice({
    customerId: alphaCustomer.id,
    billingMonth: previousMonthDate.getMonth() + 1,
    billingYear: previousMonthDate.getFullYear(),
    periodStart: previousBounds.start,
    periodEnd: previousBounds.end,
    invoiceCreationDate: new Date(previousMonthDate.getFullYear(), previousMonthDate.getMonth(), 3),
    invoiceDueDate: new Date(previousMonthDate.getFullYear(), previousMonthDate.getMonth(), 10),
    amount: 85000,
    cycleStatus: 'POSTED',
    invoiceStatus: 'PAID',
    description: 'Monthly advisory and compliance retainer',
  })
  await prisma.payment.upsert({
    where: { paymentNumber: `PAY-DEMO-${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, '0')}-ALPHA` },
    update: {
      date: new Date(previousMonthDate.getFullYear(), previousMonthDate.getMonth(), 9),
      type: 'RECEIVE',
      method: 'BANK',
      partyId: alphaCustomer.id,
      amount: 85000,
      currency: 'PKR',
      invoiceId: alphaPreviousInvoice.id,
      reference: 'Seeded monthly retainer payment',
      notes: 'Payment received against monthly compliance invoice.',
    },
    create: {
      paymentNumber: `PAY-DEMO-${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, '0')}-ALPHA`,
      date: new Date(previousMonthDate.getFullYear(), previousMonthDate.getMonth(), 9),
      type: 'RECEIVE',
      method: 'BANK',
      partyId: alphaCustomer.id,
      amount: 85000,
      currency: 'PKR',
      invoiceId: alphaPreviousInvoice.id,
      reference: 'Seeded monthly retainer payment',
      notes: 'Payment received against monthly compliance invoice.',
    },
  })

  await ensureBillingCycleInvoice({
    customerId: blueCustomer.id,
    billingMonth: currentMonthDate.getMonth() + 1,
    billingYear: currentMonthDate.getFullYear(),
    periodStart: currentBounds.start,
    periodEnd: currentBounds.end,
    invoiceCreationDate: new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), 5),
    invoiceDueDate: new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), 12),
    amount: 60000,
    cycleStatus: 'DRAFT_CREATED',
    invoiceStatus: 'DRAFT',
    description: 'Monthly billing profile for retained tax services',
  })

  await ensureLitigationInvoice({
    litigationCaseId: federalCourtCase.id,
    customerId: nexusCustomer.id,
    amount: 180000,
    date: new Date(`${currentYear}-04-02`),
    dueDate: new Date(`${currentYear}-04-12`),
    status: 'DRAFT',
    description: 'Federal constitutional court matter billing draft',
  })

  await prisma.invoice.updateMany({
    where: { partyId: { in: [alphaCustomer.id, blueCustomer.id, pakAgriCustomer.id, nexusCustomer.id] } },
    data: { currency: 'PKR' },
  })
  await prisma.payment.updateMany({
    where: { partyId: { in: [alphaCustomer.id, blueCustomer.id, pakAgriCustomer.id, nexusCustomer.id] } },
    data: { currency: 'PKR' },
  })

  console.log('TradeFix seed completed with relevant customers, litigations, services, and billing data.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
