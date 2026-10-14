type JournalNumberSettings = {
  journalPrefix?: string | null
  journalStartNumber?: number | null
  journalCurrentNumber?: number | null
}

export function formatJournalEntryNumber(prefix: string, number: number) {
  return `${prefix}${number.toString().padStart(4, "0")}`
}

function parseJournalEntryNumber(entryNumber: string, prefix: string) {
  if (!entryNumber.startsWith(prefix)) {
    return null
  }

  const numericPart = entryNumber.slice(prefix.length)

  if (!/^\d+$/.test(numericPart)) {
    return null
  }

  return Number(numericPart)
}

export function getNextJournalSequence(
  settings: JournalNumberSettings | null | undefined,
  entryNumbers: string[],
) {
  const prefix = settings?.journalPrefix || "JRN-"
  const configuredNextNumber =
    settings?.journalCurrentNumber ?? settings?.journalStartNumber ?? 1

  const highestExistingNumber = entryNumbers.reduce((highest, entryNumber) => {
    const parsedNumber = parseJournalEntryNumber(entryNumber, prefix)

    if (parsedNumber === null) {
      return highest
    }

    return Math.max(highest, parsedNumber)
  }, 0)

  const nextNumber = Math.max(configuredNextNumber, highestExistingNumber + 1)

  return {
    prefix,
    nextNumber,
    entryNumber: formatJournalEntryNumber(prefix, nextNumber),
  }
}
