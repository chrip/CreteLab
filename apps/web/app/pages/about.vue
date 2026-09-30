<template>
  <article class="page about" lang="en">
    <!-- English only, in both language versions of the site. -->
    <h1>About CreteLab</h1>
    <p class="lead">
      CreteLab turns a sentence like "driveway, 6 x 3 m, 15 cm thick, salted in winter" into a concrete recipe you can
      mix, buy or order. It started as a browser calculator for the German mix-design leaflet Zement-Merkblatt B 20.
      Today it is an open-source project with a language model I trained myself, on my own hardware.
    </p>

    <h2>How a description becomes a recipe</h2>
    <ol>
      <li>
        A fine-tuned <a href="https://github.com/convai-innovations/laya" rel="noopener">Laya</a> model (mmBERT-base,
        322 M parameters) reads the text and answers 16 typed questions about it. Does it freeze? Is there de-icing
        salt? Is it reinforced? What shape is it? For every number in the text it answers one more question: is 2 cm
        the wall, the thickness or something else? The model never writes free text, so it cannot make up a recipe.
      </li>
      <li>
        Plain code does the engineering. DIN 1045-2 rules turn the answers into exposure classes, geometry formulas
        turn shape and sizes into cubic metres, and the B 20 mix design calculates the recipe. All of this runs in your
        browser and is covered by tests.
      </li>
      <li>
        You get three ways to make it: a bagged product whose datasheet covers the requirements (or the reason none
        does), a recipe to mix yourself, and an order text for a ready-mix plant.
      </li>
    </ol>
    <p>
      I split the work this way on purpose. A language model is good at reading "the driveway gets salted" as
      "de-icing salt: yes". I would not let it decide the cement content, because rules and formulas can be checked
      line by line and a model's weights cannot.
    </p>

    <h2>Training the model</h2>
    <div class="table-wrap">
      <table class="facts">
        <tbody>
          <tr v-for="[label, value] in TRAINING" :key="label">
            <th scope="row">{{ label }}</th>
            <td>{{ value }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p>
      The teacher wrote the descriptions the way people type into a search box, typos and missing details included,
      and then voted several times on every question. The share of votes became a soft target, so the model learns how
      sure it should be along with the answer itself.
    </p>
    <p>I checked the data and the model at several points:</p>
    <ul>
      <li>
        Claude Opus 5.5 labelled 100 random descriptions blind. It agreed with the teacher on 91.1 % of the answers,
        and on 94.8 % where the teacher's votes were unanimous.
      </li>
      <li>
        One night the vLLM engine froze while its health check stayed green. A watchdog that sends a real test request,
        together with a pipeline that resumes per description, recovered the run without losing work.
      </li>
      <li>
        On 66 hand-labelled descriptions the teacher never saw, the model gets 93.6 % of the answers right, against
        49.7 % for the untrained base model. It reads 98 % of the measurement roles correctly and gets the volume right
        for all 23 descriptions that give a size. A second set of 30 objects from a web survey (sinks, shower trays,
        light wells) went from 89.6 % to 91.5 % after 2,249 descriptions of 75 new object types were added.
      </li>
    </ul>
    <p>
      The repository contains the <a :href="`${repository}/tree/main/ml`" rel="noopener">training data</a> and leaves
      out the weights. Rebuilding the model from the data takes half an hour on a GPU, while the data itself took most
      of the effort.
    </p>

    <h2>Checking the engineering</h2>
    <ul>
      <li>
        The mix design follows Zement-Merkblatt B 20 (2017) step by step. I digitised the Walz curves from its Bild 1
        at 300 dpi and fitted them to within 1 N/mm².
      </li>
      <li>
        Recomputing the leaflet's four worked examples turned up eight deviations in the original calculator. All of
        them are fixed, and the examples now run as regression tests: Beispiel III gives 383 kg cement, as printed.
      </li>
      <li>
        The advice on bagged concrete comes from twelve manufacturer datasheets. They say, for example, that nothing but
        water may be added to a bag, and no DIY-store bag is declared for de-icing salt or as watertight concrete.
      </li>
      <li>
        Every recipe on the fine concrete page cites its source (Grey Element, University of Kassel), and tests
        compare it with the quoted amounts.
      </li>
    </ul>

    <h2>Built with</h2>
    <ul>
      <li>
        Web: Nuxt 4, Vue 3 and strict TypeScript, in German and English, generated as static pages. Every page keeps
        its state in the URL, so a shared link shows the same result.
      </li>
      <li>
        Engine: a pure TypeScript package with no DOM and no UI text, only codes and numbers, covered by about 700
        Vitest tests.
      </li>
      <li>
        API: FastAPI and Pydantic. The model sits behind an interface, so the tests run without PyTorch. Checks run
        with pytest, Ruff and mypy in strict mode.
      </li>
      <li>Machine learning: Laya and PyTorch, with vLLM serving the teacher.</li>
      <li>Running it: Docker Compose (nginx and the API), and GitHub Actions on every push.</li>
    </ul>

    <h2>Open source</h2>
    <p>
      CreteLab is MIT-licensed and on <a :href="repository" rel="noopener">GitHub</a>, training data included. It
      builds on open work: Laya by Convai Innovations and Qwen are both Apache 2.0, and the mix design follows the
      publicly available Zement-Merkblätter of the German cement industry.
    </p>
    <p>
      Christoph Schaefer, a senior software developer, builds CreteLab as a side project. For load-bearing parts, ask a
      structural engineer.
    </p>
  </article>
</template>

<script setup lang="ts">
const { repository } = useRuntimeConfig().public;

const TRAINING: [string, string][] = [
  ['Teacher model', 'Qwen3.8-27B (NVFP4), served locally with vLLM'],
  ['Hardware', 'NVIDIA DGX Spark (ASUS Ascent GX10), 128 GB unified memory'],
  ['Training data', '4,349 descriptions (2,899 German, 1,450 English, 145 topics), 22,409 teacher votes'],
  ['Labelling runs', 'about 24 hours in several runs, 8 requests in parallel, about 150 to 170 tokens/s'],
  ['Tokens', 'about 3.5 M prompt and 11.8 M generated tokens'],
  ['Same runs in the cloud', 'about $110 to $250 with Claude Opus 5.5, $55 to $125 with the batch API'],
  ['Fine-tuning', "65,032 training items, 60 minutes on the Spark's GPU (a day or more on a laptop CPU)"],
  ['Inference', '20 to 60 ms per description on the GPU, about 2 s on the CPU of the Docker image'],
];

useSeoMeta({
  title: 'About',
  description: 'How CreteLab works: a Laya model trained locally on a DGX Spark, a tested B 20 mix design, Nuxt and FastAPI.',
});
</script>

<style scoped>
.about {
  max-width: 48rem;
}

.about h2 {
  margin-top: 2rem;
}

.about li + li {
  margin-top: 0.5rem;
}

.facts th {
  text-transform: none;
  letter-spacing: 0;
  font-size: 0.9rem;
  white-space: nowrap;
  width: 12rem;
}
</style>
