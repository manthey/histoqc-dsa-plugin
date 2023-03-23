import { restRequest, getApiRoot } from '@girder/core/rest'


const artifact_list = [
  "thumb_small",
  "thumb",
  "areathresh",
  "blurry",
  "bright",
  "coverslip_edge",
  "dark",
  "deconv_c0",
  "deconv_c1",
  "deconv_c2",
  "fatlike",
  "flat",
  "fuse",
  "hist",
  "mask_use",
  "pen_markings",
  "small_fill",
  "small_remove",
  "spur"
]
const histoqc_output_folder_name = 'histoqc_outputs'


function load_histoqc_subfolder(folder_id, table_id) {
  restRequest({
    method: 'GET',
    url: 'folder',
    data: {
      parentId: folder_id,
      parentType: 'folder',
      name: histoqc_output_folder_name
    }
  }).done(function (response) {
    console.log('response = ', response)
    const histoqc_output_folder_id = response[0]._id
    console.log('histoqc_output_folder_id = ', histoqc_output_folder_id)
    initialize_table(histoqc_output_folder_id, table_id)
  })
}


function initialize_table(histoqc_output_folder_id, table_id) {
  restRequest({
    method: 'GET',
    url: 'folder',
    data: {
      parentId: histoqc_output_folder_id,
      parentType: 'folder'
    }
  }).done(function (response) {
    console.log('response = ', response)

    const cell_style = 'padding: 5px; border: 3px inset;'

    const table = document.getElementById(table_id)
    const header_row = document.createElement('tr')
    for (const artifact_name of ['filename'].concat(artifact_list)) {
      const cell = document.createElement('th')
      cell.innerHTML = artifact_name
      cell.style.cssText = cell_style
      header_row.appendChild(cell)
    }
    table.appendChild(header_row)

    let row_count = 0
    for (const histoqc_output_subfolder of response) {
      if (histoqc_output_subfolder.size === 0) continue
      console.log('histoqc_output_subfolder = ', histoqc_output_subfolder)
      const subfolder_name = histoqc_output_subfolder.name
      const subfolder_id = histoqc_output_subfolder._id

      const row = document.createElement('tr')
      let cell = document.createElement('td')
      cell.innerHTML = subfolder_name
      cell.style.cssText = cell_style
      row.appendChild(cell)

      for (const artifact_name of artifact_list) {
        const artifact_filename = subfolder_name + '_' + artifact_name + '.png'
        cell = document.createElement('td')
        cell.innerHTML = 'Loading ' + artifact_filename + ' ...'
        cell.style.cssText = cell_style
        cell.id = crypto.randomUUID()
        row.appendChild(cell)

        load_histoqc_output_cell(cell.id, subfolder_id, artifact_filename)
      }

      table.appendChild(row)

      row_count++
    }
  })
}


function load_histoqc_output_cell(cell_id, folder_id, output_name) {
  console.log('cell_id, folder_id = ', cell_id, folder_id, output_name)
  restRequest({
    method: 'GET',
    url: 'item',
    data: {
      folderId: folder_id,
      name: output_name,
      limit: 1
    }
  }).done(function (response) {
    const histoqc_output_item_id = response[0]._id
    restRequest({
      method: 'POST',
      url: 'item/' + histoqc_output_item_id + '/tiles',
      compression: 'webp',
      error: null
    }).always(() => {
      const thumbnail_url = getApiRoot() + '/item/' + histoqc_output_item_id + '/tiles/thumbnail'
      document.getElementById(cell_id).innerHTML = '<a target="_blank" href="#item/' + histoqc_output_item_id + '"><img src="' + thumbnail_url + '"></img></a>'
    })
  })
}

function triggerHistoQCJob(folder_id, div_id) {
  document.getElementById(div_id).innerHTML = '<p>Starting HistoQC job, please wait...</p>';

  restRequest({
    method: 'GET',
    url: 'folder',
    data: {
      parentId: folder_id,
      parentType: 'folder',
      name: histoqc_output_folder_name
    }
  }).then((response) => {
    if (response.length > 0) {
      return restRequest({
        method: 'DELETE',
        url: 'folder/' + response[0]._id
      });  
    }
  }, () => {
    return Promise.resolve();
  }).then(() => {
    restRequest({
      method: 'POST',
      url: 'slicer_cli_web/histoqc_latest/HistoQC/run',
      data: {
        inputDir: folder_id,
        girderApiUrl: "",
        girderToken: ""
      }
    }).done((response) => {
      const job_url = '#job/' + response._id
      document.getElementById(div_id).innerHTML = '<a target="_blank" href="' + job_url + '">HistoQC job submitted. Click here to view logs.</a>'
    });
  });
}


export function renderHistoQC(widget, folder_id) {
  console.log('folder_id = ', folder_id)
  
  window.triggerHistoQCJob = triggerHistoQCJob
  const afterHTML = `
    <div>

      <hr><hr>
      <h3>HistoQC</h3>
      <a href="https://github.com/choosehappy/HistoQC" target="_blank">View on Github</a>
      <br>
      <br>

      <div id="run-histoqc-job">
        <button id="histoqc-button">Click here to (re)run HistoQC on all images in this folder.</button>
      </div>
      <br>

      <div id="histoqc-parallel-div">
      </div>
      <br>

      <div id="histoqc-table-div">
        <table id="histoqc_output_table"></table>
      </div>
      <br>
      <hr><hr>

    </div>
  `
  widget.after(afterHTML)
  document.getElementById('histoqc-button').addEventListener('click', () => {
    triggerHistoQCJob(folder_id, 'run-histoqc-job');
  })

  load_histoqc_subfolder(folder_id, 'histoqc_output_table')
}