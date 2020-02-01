window.addEventListener('load', function () {
  const buttonEl = document.getElementById('run')
  buttonEl.addEventListener('click', async function () {
    const input = document.getElementById('input').value
    buttonEl.classList.add('is-loading')

    const interpretationEl = document.getElementById('interpretation')
    try {
      const interpretations = await interpret(interpretationEl, input)
      try {
        const element = await parseInterpretations(interpretations)
        document.getElementById('output').innerHTML = ''
        document.getElementById('output').appendChild(element)
      } catch (err) {

      }
    } catch (err) {
      console.error(err)
    }

    buttonEl.classList.remove('is-loading')
  })
})

const translations = {
  ADJ: 'Adjektiv',
  ADP: 'Adposition',
  ADV: 'Adverb',
  AUX: 'Hjälpverb',
  CCONJ: 'Samordnande_konjunktion',
  DET: 'Determinativa',
  INTJ: 'Interjektion',
  NOUN: 'Substantiv',
  NUM: 'Räkneord',
  PART: 'Partikel',
  PRON: 'Pronomen',
  PROPN: 'Egennamn',
  PUNCT: 'Skiljetecken',
  SCONJ: 'Subjunktion',
  SYM: 'Symbol',
  VERB: 'Verb',
  // Ord, bas
  barn: 'child',
  bakgrund: 'background',
  blå: 'blue',
  bred: 'height',
  höjd: 'height',
  längd: 'width'
}

async function parseInterpretations (map) {
  const wrapper = document.createElement('div')

  for (let mapIndex = 0; mapIndex < map.length; mapIndex++) {
    const mapArr = Array.from(map[mapIndex])

    for (let index = 0; index < mapArr.length; index++) {
      const arr = mapArr[index]

      const div = document.createElement('div')
      div.id = arr[0]

      const options = Object.entries(arr[1])

      for (let optionsIndex = 0; optionsIndex < options.length; optionsIndex++) {
        const [name, val] = options[optionsIndex]
        const translatedName = translations[name] || name
        const translatedValue = translations[val] || val

        if (div.style[translatedName] !== undefined) {
          switch (translatedName) {
            case 'height':
            case 'width':
              div.style[translatedName] = translatedValue + 'px'
              break
            default:
              div.style[translatedName] = Number.isNaN(Number(translatedValue)) ? translatedValue : Number(translatedValue)
              break
          }
        } else {
          console.log('[parseIntrepretations] Unhandled option', { name, val })
        }
      }

      wrapper.appendChild(div)
    }
  }

  return Promise.resolve(wrapper)
}

async function interpret (el, value) {
  const api = await interpretationAPI(value)
  const sentences = api.result

  const interpretation = sentences.map(sentence => {
    const words = sentence
    return words.map(word => Object({
      value: word.word_form,
      base: word.lemma,
      class: word.ud_tags.pos_tag
    }))
  })

  const elements = []
  for (let sentenceIndex = 0; sentenceIndex < interpretation.length; sentenceIndex++) {
    const sentence = interpretation[sentenceIndex]

    elements.push(new Map())

    let currentSentence = elements[sentenceIndex]
    for (let wordIndex = 0; wordIndex < sentence.length; wordIndex++) {
      const h = new Interpretations(sentence, wordIndex)

      const mapArr = Array.from(currentSentence)
      let me = mapArr.find(i => i[1].me)

      switch (h.word.class) {
        // Namn
        case 'PROPN': {
          if (!currentSentence.has(h.word.base)) currentSentence.set(h.word.base, {})
          const el = currentSentence.get(h.word.base)

          const rule1 = h.previousBaseWordsTXT.includes(`jag heta ${h.word.base}`)
          const rule2 = h.previousBaseWordsTXT.includes(`jag kalla ${h.word.base}`)
          const rule3 = h.previousBaseWordsTXT.includes(`jag kalla för ${h.word.base}`)
          if (rule1 || rule2 || rule3) el.me = true

          // const rule4 = h.previousBaseWordsTXT
          break
        }
        case 'VERB':
        case 'AUX': {
          if (!['heta', 'heter'].includes(h.word.base)) {
            switch (h.previousClass) {
              case 'PRON': {
                const rule1 = h.previousBaseWordsTXT.includes(`jag ${h.word.base}`)
                if (rule1) {
                  if (!me) {
                    // Se om "jag" finns i den tidigare meningen.
                    for (let index = 0; index < elements.length; index++) {
                      const mapArr = Array.from(elements[index])

                      me = mapArr.find(i => i[1].me)

                      if (me) {
                        currentSentence = elements[index]
                        break
                      }
                    }
                  }

                  const nounIndex = h.nextClasses.findIndex(c => c === 'NOUN')
                  const nounWord = h.nextBaseWords[nounIndex]

                  const nextNonDeterminativeWordIndex = h.nextClasses.findIndex(c => c !== 'DET')
                  if (me && nextNonDeterminativeWordIndex < 2) currentSentence.get(me[0])[nounWord] = h.nextWords[nextNonDeterminativeWordIndex]
                }
                break
              }
              case 'NOUN': {
                const rule1 = h.previousBaseWordsTXT.includes(`jag ${h.previousBaseWord} vara`)
                if (rule1) {
                  if (!me) {
                    // Se om "jag" finns i den tidigare meningen.
                    for (let index = 0; index < elements.length; index++) {
                      const mapArr = Array.from(elements[index])

                      me = mapArr.find(i => i[1].me)

                      if (me) {
                        currentSentence = elements[index]
                        break
                      }
                    }
                  }

                  const nextNonDeterminativeWordIndex = h.nextClasses.findIndex(c => c !== 'DET')
                  if (me && nextNonDeterminativeWordIndex < 2) currentSentence.get(me[0])[h.previousBaseWord] = h.nextWords[nextNonDeterminativeWordIndex]
                }
              }
            }
          }
          break
        }
      }
    }
  }

  el.innerText = interpretation.map(sentence => {
    const words = sentence
    return words.map(word => `${word.base} (${word.class} / ${translations[word.class]})`).join(' | ')
  }).join(' ')

  return Promise.resolve(elements)
}

async function interpretationAPI (value) {
  const request = await fetch(`${window.location.origin}/api`, { body: JSON.stringify({ value }), method: 'POST', headers: new Headers({ 'content-type': 'application/json' }) })
  if (request.status === 200) {
    try {
      const response = await request.json()
      return response
    } catch (err) {
      alert(err)
    }
  }
}

class Interpretations {
  constructor (sentence, wordIndex) {
    this.word = sentence[wordIndex]

    this.words = sentence.map(word => word.value)
    this.baseWords = sentence.map(word => word.base)
    this.classes = sentence.map(word => word.class)

    this.previousWord = sentence[wordIndex - 1]
    this.nextWord = sentence[wordIndex + 1]

    this.previousBaseWord = this.baseWords[wordIndex - 1]
    this.nextBaseWord = this.baseWords[wordIndex + 1]

    this.previousWords = this.words.slice(0, wordIndex + 1)
    this.previousWordsTXT = this.previousWords.join(' ')

    this.nextWords = this.words.slice(wordIndex + 1)
    this.nextWordsTXT = this.nextWords.join(' ')

    this.previousBaseWords = this.baseWords.slice(0, wordIndex + 1)
    this.previousBaseWordsTXT = this.previousBaseWords.join(' ')

    this.nextBaseWords = this.baseWords.slice(wordIndex + 1)
    this.nextBaseWordsTXT = this.nextBaseWords.join(' ')

    this.previousClasses = this.classes.slice(0, wordIndex + 1)
    this.previousClassesTXT = this.previousClasses.join(' ')

    this.nextClasses = this.classes.slice(wordIndex + 1)
    this.nextClassesTXT = this.nextClasses.join(' ')

    this.previousClass = this.classes[wordIndex - 1]
    this.nextClass = this.classes[wordIndex + 1]
  }
}
