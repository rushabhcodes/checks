import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement, PcbCourtyardRect } from "circuit-json"
import { Circuit } from "tscircuit"
import { checkCourtyardOverlap } from "lib/check-courtyard-overlap/checkCourtyardOverlap"

const ChipWithCourtyardRect = (props: { name: string; pcbX: number }) => (
  <chip
    name={props.name}
    pcbX={props.pcbX}
    pcbY={0}
    footprint={
      <footprint>
        <smtpad
          portHints={["pin1"]}
          pcbX="-0.8mm"
          pcbY="0mm"
          width="0.8mm"
          height="0.8mm"
          shape="rect"
        />
        <smtpad
          portHints={["pin2"]}
          pcbX="0.8mm"
          pcbY="0mm"
          width="0.8mm"
          height="0.8mm"
          shape="rect"
        />
        <courtyardrect width="4mm" height="2mm" />
      </footprint>
    }
  />
)

test("overlapping courtyards on different layers should not be flagged", async () => {
  const circuit = new Circuit()

  circuit.add(
    <board width="20mm" height="10mm">
      <ChipWithCourtyardRect name="U1" pcbX={0} />
      <ChipWithCourtyardRect name="U2" pcbX={3} />
    </board>,
  )

  await circuit.renderUntilSettled()

  const renderedCircuitJson = circuit.getCircuitJson() as AnyCircuitElement[]
  const circuitJson: AnyCircuitElement[] = renderedCircuitJson.filter(
    (el) => el.type !== "pcb_courtyard_overlap_error",
  )

  const courtyards = circuitJson.filter(
    (el): el is PcbCourtyardRect => el.type === "pcb_courtyard_rect",
  )
  expect(courtyards).toHaveLength(2)
  expect(courtyards.map((el) => el.layer)).toEqual(["top", "top"])

  const bottomLayerComponentId = courtyards[1].pcb_component_id
  const circuitJsonWithDifferentLayers: AnyCircuitElement[] = circuitJson.map(
    (el) => {
      if (
        el.type === "pcb_courtyard_rect" &&
        el.pcb_component_id === bottomLayerComponentId
      ) {
        return { ...el, layer: "bottom" as const }
      }
      return el
    },
  )

  const layeredCourtyards = circuitJsonWithDifferentLayers.filter(
    (el): el is PcbCourtyardRect => el.type === "pcb_courtyard_rect",
  )
  expect(layeredCourtyards.map((el) => el.layer).sort()).toEqual([
    "bottom",
    "top",
  ])

  const errors = checkCourtyardOverlap(circuitJsonWithDifferentLayers)
  expect(errors).toHaveLength(0)

  expect(
    convertCircuitJsonToPcbSvg([...circuitJsonWithDifferentLayers, ...errors], {
      shouldDrawErrors: true,
      showCourtyards: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
