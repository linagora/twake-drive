import { readFileSync } from 'fs'
import path from 'path'

import { USERS } from '../helpers/config'
import { test, expect, stamp } from '../helpers/fixtures'
import { createFile, trashById } from '../helpers/stack'
import { ScribePluginPage } from '../pages/ScribePluginPage'

// The scribe plugin in a presentation, played as Drive plays it: a bullet, a
// part of it, several bullets, the title, the whole slide, text boxes, the
// title slide, and the look of the text written. The deck: a title slide,
// a slide of three bullets, a slide of two text boxes, a slide of two
// bullets.

const DECK = path.resolve(__dirname, '..', 'fixtures', 'scribe', 'slides.pptx')
const PPTX =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
const FIRST =
  'Le partage de fichier est entierement refait, avec des lien protégé par mot de passe'
const SECOND = "La recherche affiche les résultats en moins d'une seconde"
const THIRD =
  "Un assistant d'écriture corrige, résume et traduit le texte sélectionné"

// The decks go to the trash after their test: in a runtime kept between
// runs, they would fill the root of the Drive of Alice
const fileIds: string[] = []
test.afterEach(async () => {
  for (const fileId of fileIds.splice(0)) {
    await trashById(USERS.alice.instance, fileId)
  }
})

const openDeck = async (
  page: ConstructorParameters<typeof ScribePluginPage>[0]
): Promise<ScribePluginPage> => {
  const fileId = await createFile({
    instance: USERS.alice.instance,
    name: `Scribe ${stamp()} slides.pptx`,
    content: readFileSync(DECK),
    contentType: PPTX
  })
  fileIds.push(fileId)
  const scribe = new ScribePluginPage(page)
  await scribe.open(USERS.alice.appUrl, fileId)
  return scribe
}

test.describe(
  'the scribe plugin in a presentation',
  { tag: '@e2e-scribe' },
  () => {
    test('replaces a bullet, then the bullets it wrote, and inserts under it', async ({
      alicePage
    }) => {
      const scribe = await openDeck(alicePage)
      const read = (): ReturnType<ScribePluginPage['readSlide']> =>
        scribe.readSlide()
      await scribe.goToSlide(2)
      expect((await read()).shapes[1].lines).toEqual([FIRST, SECOND, THIRD])

      await scribe.selectInSlide(1, 0)
      expect(await scribe.getContent()).toMatchObject({
        content: `- ${FIRST}`,
        target: 'selection'
      })
      const fixed =
        'Le partage de fichiers est entièrement refait, avec des liens protégés par mot de passe.'
      await scribe.applyAnswer('replace', fixed, read)
      let slide = await read()
      expect(slide.shapes[1].lines).toEqual([fixed, SECOND, THIRD])
      expect(slide.shapes[0].lines[0]).toBe('Nouveautés')
      expect(slide.selection).toBe(fixed)

      await scribe.applyAnswer(
        'replace',
        '- Partage refait\n- Liens protégés par mot de passe',
        read
      )
      slide = await read()
      expect(slide.shapes[1].lines).toEqual([
        'Partage refait',
        'Liens protégés par mot de passe',
        SECOND,
        THIRD
      ])
      expect(slide.selection).toBe('Partage refait')

      await scribe.applyAnswer('replace', 'Partage et liens protégés', read)
      expect((await read()).shapes[1].lines).toEqual([
        'Partage et liens protégés',
        SECOND,
        THIRD
      ])

      await scribe.applyAnswer('insert', 'Un nouveau point', read)
      slide = await read()
      expect(slide.shapes[1].lines).toEqual([
        'Partage et liens protégés',
        'Un nouveau point',
        SECOND,
        THIRD
      ])
      expect(slide.selection).toBe('Un nouveau point')
    })

    test('replaces a part of a bullet in its line', async ({ alicePage }) => {
      const scribe = await openDeck(alicePage)
      const read = (): ReturnType<ScribePluginPage['readSlide']> =>
        scribe.readSlide()
      await scribe.goToSlide(2)
      await scribe.selectInSlide(1, 0)
      await scribe.press('Home', ...Array<string>(21).fill('Shift+ArrowRight'))
      expect((await read()).selection).toBe('Le partage de fichier')
      expect(await scribe.getContent()).toMatchObject({
        content: 'Le partage de fichier',
        target: 'selection'
      })

      await scribe.applyAnswer('replace', 'Le partage de **documents**', read)
      const slide = await read()
      expect(slide.shapes[1].lines[0]).toBe(
        'Le partage de documents est entierement refait, avec des lien protégé par mot de passe'
      )
      expect(slide.selection).toBe('Le partage de documents')
    })

    test('replaces several bullets', async ({ alicePage }) => {
      const scribe = await openDeck(alicePage)
      const read = (): ReturnType<ScribePluginPage['readSlide']> =>
        scribe.readSlide()
      await scribe.goToSlide(2)
      await scribe.selectInSlide(1, 0)
      await scribe.press('Home', 'Shift+Control+End')
      expect((await read()).selection).toBe([FIRST, SECOND, THIRD].join(' '))
      expect((await scribe.getContent()).content).toBe(
        `- ${FIRST}\n- ${SECOND}\n- ${THIRD}`
      )

      await scribe.applyAnswer(
        'replace',
        '- Partage refait\n- Recherche instantanée',
        read
      )
      expect((await read()).shapes[1].lines).toEqual([
        'Partage refait',
        'Recherche instantanée'
      ])
    })

    test('replaces the title, and the body as a shape', async ({
      alicePage
    }) => {
      const scribe = await openDeck(alicePage)
      const read = (): ReturnType<ScribePluginPage['readSlide']> =>
        scribe.readSlide()
      await scribe.goToSlide(2)
      await scribe.selectInSlide(0)
      expect(await scribe.getContent()).toMatchObject({
        content: '# Nouveautés',
        target: 'selection'
      })

      await scribe.applyAnswer('replace', '# Les nouveautés de Drive 2', read)
      let slide = await read()
      expect(slide.shapes[0].lines[0]).toBe('Les nouveautés de Drive 2')
      expect(slide.shapes[1].lines).toEqual([FIRST, SECOND, THIRD])
      expect(slide.selection).toBe('Les nouveautés de Drive 2')

      await scribe.selectInSlide(1)
      await scribe.applyAnswer(
        'replace',
        'Trois nouveautés :\n\n1. le partage\n2. la recherche\n3. un assistant',
        read
      )
      slide = await read()
      expect(slide.shapes[1].lines).toEqual([
        'Trois nouveautés :',
        'le partage',
        'la recherche',
        'un assistant'
      ])
    })

    test('works on the whole slide without a selection', async ({
      alicePage
    }) => {
      const scribe = await openDeck(alicePage)
      const read = (): ReturnType<ScribePluginPage['readSlide']> =>
        scribe.readSlide()
      await scribe.goToSlide(2)
      expect((await read()).selection).toBe('')
      expect(await scribe.getContent()).toMatchObject({
        content: `# Nouveautés\n\n- ${FIRST}\n- ${SECOND}\n- ${THIRD}`,
        target: 'slide'
      })

      const summary = 'En résumé, une version plus simple et plus rapide.'
      await scribe.applyAnswer('insert', summary, read)
      const slide = await read()
      expect(slide.shapes[1].lines).toEqual([FIRST, SECOND, THIRD, summary])
      expect(slide.shapes[0].lines[0]).toBe('Nouveautés')
      expect(slide.selection).toBe(summary)
    })

    test('writes in the text box of the selection only', async ({
      alicePage
    }) => {
      const scribe = await openDeck(alicePage)
      const read = (): ReturnType<ScribePluginPage['readSlide']> =>
        scribe.readSlide()
      await scribe.goToSlide(3)
      await scribe.selectInSlide(2, 1)
      expect(await scribe.getContent()).toMatchObject({
        content:
          'Les autre client suivrons a partir du 3 novembre, sans interruption de service.',
        target: 'selection'
      })

      const fixed =
        'Les autres clients suivront à partir du 3 novembre, sans interruption de service.'
      await scribe.applyAnswer('replace', fixed, read)
      let slide = await read()
      expect(slide.shapes[2].lines).toEqual(['Novembre', fixed])
      expect(slide.shapes[1].lines).toEqual([
        'Octobre',
        'Les clients pilote migre la semaine du 20 octobre.'
      ])

      await scribe.selectInSlide(1, 0)
      await scribe.applyAnswer('insert', 'Semaine 43', read)
      slide = await read()
      expect(slide.shapes[1].lines).toEqual([
        'Octobre',
        'Semaine 43',
        'Les clients pilote migre la semaine du 20 octobre.'
      ])

      await scribe.selectInSlide(2)
      expect((await scribe.getContent()).content).toBe(`Novembre\n\n${fixed}`)
    })

    test('replaces a whole body, and writes under the subtitle of the title slide', async ({
      alicePage
    }) => {
      const scribe = await openDeck(alicePage)
      const read = (): ReturnType<ScribePluginPage['readSlide']> =>
        scribe.readSlide()
      await scribe.goToSlide(4)
      expect((await read()).shapes[1].lines).toEqual([
        'Former les équipes support',
        'Publier la documentation'
      ])
      await scribe.selectInSlide(1)
      await scribe.applyAnswer('replace', 'Tout est prêt.', read)
      expect((await read()).shapes[1].lines).toEqual(['Tout est prêt.'])

      await scribe.goToSlide(1)
      expect(await scribe.getContent()).toMatchObject({
        content:
          '# Lancement de Twake Drive 2\n\nComité de direction, 3 novembre',
        target: 'slide'
      })
      await scribe.applyAnswer('insert', 'Version 2.0', read)
      expect((await read()).shapes[1].lines).toEqual([
        'Comité de direction, 3 novembre',
        'Version 2.0'
      ])
    })

    test('writes a bullet in the look of most of its former text, with the emphasis of the answer', async ({
      alicePage
    }) => {
      const scribe = await openDeck(alicePage)
      const read = (): ReturnType<ScribePluginPage['readSlide']> =>
        scribe.readSlide()
      await scribe.goToSlide(2)
      // The bullet in red, a word in blue, its first words in bold
      await scribe.setSlideRuns(1, 0, [
        { text: 'Le partage', isBold: true, size: 28, rgb: [200, 30, 30] },
        { text: ' de ', size: 28, rgb: [200, 30, 30] },
        { text: 'fichier', size: 28, rgb: [30, 60, 200] },
        {
          text: ' est entierement refait, avec des lien protégé par mot de passe',
          size: 28,
          rgb: [200, 30, 30]
        }
      ])
      let runs = await scribe.readSlideRuns(1, 0)
      const red = runs[1].fill
      expect(runs[2].fill).not.toBe(red)

      await scribe.selectInSlide(1, 0)
      expect((await scribe.getContent()).content).toBe(
        '- **Le partage** de fichier est entierement refait, avec des lien protégé par mot de passe'
      )
      await scribe.applyAnswer(
        'replace',
        '**Le partage** de fichiers est *entièrement* refait, avec des liens ~~protégé~~ protégés par mot de passe',
        read
      )
      runs = await scribe.readSlideRuns(1, 0)
      expect(
        runs.map(run => [run.text, run.bold, run.italic, run.strike])
      ).toEqual([
        ['Le partage', true, false, false],
        [' de fichiers est ', false, false, false],
        ['entièrement', false, true, false],
        [' refait, avec des liens ', false, false, false],
        ['protégé', false, false, true],
        [' protégés par mot de passe', false, false, false]
      ])
      expect(runs.every(run => run.size === 28 && run.fill === red)).toBe(true)

      await scribe.applyAnswer(
        'replace',
        '- **Partage** refait\n- Liens *protégés*',
        read
      )
      const second = await scribe.readSlideRuns(1, 1)
      expect(
        second.map(run => [run.text, run.bold, run.italic, run.size])
      ).toEqual([
        ['Liens ', false, false, 28],
        ['protégés', false, true, 28]
      ])
      expect(second.every(run => run.fill === red)).toBe(true)

      await scribe.selectInSlide(1)
      expect((await scribe.getContent()).content).toMatch(
        /^- \*\*Partage\*\* refait\n- Liens \*protégés\*\n/
      )
    })
  }
)
